import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("runtime", Path(__file__).parents[1] / "tools/runtime.py")
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.release = self.root / "release"
        self.release.mkdir()
        self.manifest = {"schemaVersion": 1, "release": "0.1.0", "packages": [], "installFiles": []}
        for index in range(9):
            file = f"package-{index}.tgz"
            data = str(index).encode()
            (self.release / file).write_bytes(data)
            self.manifest["packages"].append({"file": file, "sha256": hashlib.sha256(data).hexdigest()})
        for file in ["package.json", "package-lock.json"]:
            data = b"{}"
            (self.release / file).write_bytes(data)
            self.manifest["installFiles"].append({"file": file, "sha256": hashlib.sha256(data).hexdigest()})
        self.save()

    def save(self):
        (self.release / "manifest.json").write_text(json.dumps(self.manifest))

    def test_admission_rejects_tamper_traversal_and_duplicates(self):
        for invalid in ["../outside.tgz", "/outside.tgz", "package-1.tgz"]:
            with self.subTest(invalid=invalid):
                self.manifest["packages"][0]["file"] = invalid
                self.save()
                with self.assertRaises(runtime.InstallError):
                    runtime.admit_release(self.release)
        self.manifest["packages"][0]["file"] = "package-0.tgz"
        self.save()
        (self.release / "package-0.tgz").write_bytes(b"modified")
        with self.assertRaises(runtime.InstallError):
            runtime.admit_release(self.release)
        (self.release / "package-0.tgz").write_bytes(b"0")
        (self.release / "package-lock.json").write_bytes(b"tampered lock")
        with self.assertRaises(runtime.InstallError):
            runtime.admit_release(self.release)

    def test_install_all_packages_and_resume_without_installing_again(self):
        house = self.root / "house"
        node, npm = self.root / "node", self.root / "npm"
        npm.touch()
        node.touch()
        calls = []
        def process(args, **kwargs):
            if args[-1] == "--version":
                return SimpleNamespace(stdout="v26.13.1\n")
            calls.append(args)
            entry = Path(args[args.index("--prefix") + 1]) / runtime.ENTRY
            entry.parent.mkdir(parents=True, exist_ok=True)
            entry.touch()
        with patch.object(runtime, "ensure_node", return_value=(node, npm)), patch.object(runtime, "run", side_effect=process):
            receipt = runtime.install(self.release, house)
            self.assertEqual(receipt["status"], "installed")
            self.assertEqual(calls[0][1], "ci")
            self.assertEqual(len(list(Path(receipt["prefix"]).glob("*.tgz"))), 9)
            self.assertEqual((Path(receipt["prefix"]) / "package-lock.json").read_bytes(), b"{}")
            self.assertEqual(runtime.install(self.release, house), receipt)
            self.assertEqual(len(calls), 1)
            node.unlink()
            runtime.install(self.release, house)
            self.assertEqual(len(calls), 2)

    def test_failed_install_is_resumable_and_not_complete(self):
        house = self.root / "house"
        npm = self.root / "npm"
        npm.touch()
        with patch.object(runtime, "ensure_node", return_value=(self.root / "node", npm)), patch.object(runtime, "run", side_effect=runtime.InstallError("network interrupted")):
            with self.assertRaises(runtime.InstallError):
                runtime.install(self.release, house)
        receipt = json.loads((house / ".agenticu/runtime/runtime.json").read_text())
        self.assertEqual(receipt["status"], "installing")
        original = (house / ".agenticu/runtime/runtime.json").read_bytes()
        with patch.object(runtime.os, "replace", side_effect=OSError("interrupted before replace")):
            with self.assertRaises(runtime.InstallError):
                runtime.write_checkpoint(house / ".agenticu/runtime/runtime.json", runtime.read_checkpoint(house / ".agenticu/runtime/runtime.json"))
        self.assertEqual((house / ".agenticu/runtime/runtime.json").read_bytes(), original)
        broken = house / ".agenticu/runtime/runtime.json"
        for malformed in ['{"schemaVersion":1}', '[1,2]', '{broken']:
            broken.write_text(malformed)
            with self.assertRaises(runtime.InstallError):
                runtime.install(self.release, house)
            self.assertEqual(broken.read_text(), malformed)

    def test_changed_manifest_failure_preserves_previous_release(self):
        house = self.root / "house"
        node, npm = self.root / "node", self.root / "npm"
        node.touch()
        npm.touch()
        def process(args, **kwargs):
            entry = Path(args[args.index("--prefix") + 1]) / runtime.ENTRY
            entry.parent.mkdir(parents=True)
            entry.write_text("original runtime")
        with patch.object(runtime, "ensure_node", return_value=(node, npm)), patch.object(runtime, "run", side_effect=process):
            previous = runtime.install(self.release, house)
        self.manifest["note"] = "new manifest same version"
        self.save()
        with patch.object(runtime, "ensure_node", return_value=(node, npm)), patch.object(runtime, "run", side_effect=runtime.InstallError("interrupted")):
            with self.assertRaises(runtime.InstallError):
                runtime.install(self.release, house)
        current = runtime.read_checkpoint(house / ".agenticu/runtime/runtime.json")
        self.assertNotEqual(current.prefix, previous["prefix"])
        self.assertEqual(Path(previous["entry"]).read_text(), "original runtime")

    def test_unsupported_platform(self):
        with patch.object(runtime.platform, "system", return_value="Windows"):
            with self.assertRaises(runtime.InstallError):
                runtime.node_platform()

    def test_existing_version_manager_shim_uses_actual_node_directory(self):
        binaries = self.root / "actual-bin"
        binaries.mkdir()
        node, npm = binaries / "node", binaries / "npm"
        node.touch()
        npm.touch()
        def process(args, **kwargs):
            return SimpleNamespace(stdout="v26.13.1\n" if args[-1] == "--version" else str(node) + "\n")
        with patch.object(runtime.shutil, "which", return_value="/version-manager/shims/node"), patch.object(runtime, "run", side_effect=process), patch.object(runtime, "fetch") as fetch:
            self.assertEqual(runtime.ensure_node(self.root), (node, npm))
            fetch.assert_not_called()

    def test_download_hash_failure_prevents_extraction(self):
        folder = self.root / "runtime"
        folder.mkdir()
        def download(url, destination):
            destination.write_bytes(b"bad archive" if url.endswith("tar.gz") else b"0" * 64 + b"  node-v26.13.1-darwin-arm64.tar.gz\n")
        with patch.object(runtime, "node_platform", return_value="darwin-arm64"), patch.object(runtime.shutil, "which", return_value=None), patch.object(runtime, "fetch", side_effect=download):
            with self.assertRaisesRegex(runtime.InstallError, "checksum mismatch"):
                runtime.ensure_node(folder)
        self.assertEqual(list(folder.iterdir()), [])

    def test_npm_executable_shell_shim_uses_selected_node_path(self):
        house = self.root / "house"
        binaries = self.root / "selected-bin"
        binaries.mkdir()
        node, npm = binaries / "node", binaries / "npm"
        node.write_text("#!/bin/sh\nexit 0\n")
        node.chmod(0o755)
        npm.write_text("#!/bin/sh\nset -eu\n[ \"$(command -v node)\" = \"$(dirname \"$0\")/node\" ]\n[ \"$1\" = ci ]\n[ \"$2\" = --prefix ]\nmkdir -p \"$3/node_modules/@agentic-u/cli/dist\"\nprintf '%s' shim-installed > \"$3/node_modules/@agentic-u/cli/dist/main.js\"\n")
        npm.chmod(0o755)
        with patch.object(runtime, "ensure_node", return_value=(node, npm)):
            receipt = runtime.install(self.release, house)
        self.assertEqual(Path(receipt["entry"]).read_text(), "shim-installed")
        self.assertEqual(receipt["status"], "installed")
