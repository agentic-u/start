import json
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import implementations
from runtime import InstallError, digest


class AcquisitionTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.source = self.root / "source"
        self.source.mkdir()
        for name, content in {"package.json": "{}", "package-lock.json": "{}", "entry.mjs": "export {};"}.items():
            (self.source / name).write_text(content)
        self.manifest = {"schemaVersion": 1, "release": "0.1.0",
                         "node": {"minimum": "26.13.1", "major": 26},
                         "source": {"repository": "fixture", "commit": "fixture"},
                         "entries": {"fixture": "entry.mjs"},
                         "files": [{"path": name, "sha256": digest(self.source / name)}
                                   for name in ["package.json", "package-lock.json", "entry.mjs"]]}
        (self.source / "manifest.json").write_text(json.dumps(self.manifest))
        self.archive = self.root / "release.tar.gz"
        with tarfile.open(self.archive, "w:gz") as bundle:
            for file in self.source.iterdir():
                bundle.add(file, arcname=file.name)
        self.catalog = {"implementations": {"fixture": {"url": "https://example.invalid/release", "sha256": digest(self.archive)}}}

    def acquire(self):
        return implementations.install(self.catalog, "fixture", self.root / "owner", self.archive)

    @patch("implementations.ensure_node", return_value=(Path("/node"), Path("/npm")))
    @patch("implementations.run")
    def test_changed_archive_never_executes_package_manager(self, run, node):
        self.archive.write_bytes(self.archive.read_bytes() + b"changed")
        with self.assertRaisesRegex(InstallError, "checksum mismatch"):
            self.acquire()
        run.assert_not_called()

    @patch("implementations.ensure_node", return_value=(Path("/node"), Path("/npm")))
    @patch("implementations.run")
    def test_verified_install_reopens_and_rejects_modified_entry(self, run, node):
        receipt = self.acquire()
        self.assertEqual(self.acquire(), receipt)
        run.assert_called_once()
        Path(receipt["entries"]["fixture"]).write_text("changed")
        with self.assertRaisesRegex(InstallError, "changed or missing"):
            self.acquire()

    @patch("implementations.ensure_node", return_value=(Path("/node"), Path("/npm")))
    @patch("implementations.run")
    def test_archive_link_refused_before_execution(self, run, node):
        with tarfile.open(self.archive, "w:gz") as bundle:
            link = tarfile.TarInfo("escape")
            link.type = tarfile.SYMTYPE
            link.linkname = "../outside"
            bundle.addfile(link)
        self.catalog["implementations"]["fixture"]["sha256"] = digest(self.archive)
        with self.assertRaisesRegex(InstallError, "links or special"):
            self.acquire()
        run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
