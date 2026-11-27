#!/usr/bin/env python3
"""Acquire a pinned implementation into the owner's private workspace."""
import argparse
import json
import os
from pathlib import Path
import re
import sys
import tarfile
import tempfile

from runtime import InstallError, digest, ensure_node, fetch, run

CATALOG = Path(__file__).resolve().parents[1] / "implementations.json"


def admit_manifest(directory):
    try:
        manifest = json.loads((directory / "manifest.json").read_text())
        if (manifest["schemaVersion"] != 1 or manifest["release"] != "0.1.0"
                or manifest["node"] != {"minimum": "26.13.1", "major": 26}
                or not isinstance(manifest["files"], list) or not manifest["files"]):
            raise InstallError("unsupported implementation manifest")
        paths = set()
        for item in manifest["files"]:
            name, expected = item["path"], item["sha256"]
            relative = Path(name)
            if (relative.is_absolute() or ".." in relative.parts or name in paths
                    or re.fullmatch(r"[0-9a-f]{64}", expected) is None):
                raise InstallError("invalid implementation file identity")
            paths.add(name)
            file = directory / relative
            if file.is_symlink() or not file.is_file() or digest(file) != expected:
                raise InstallError(f"implementation file changed or missing: {name}")
        for name in ["package.json", "package-lock.json", *manifest["entries"].values()]:
            if name not in paths:
                raise InstallError(f"unverified implementation entry: {name}")
        return manifest
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise InstallError(f"invalid implementation manifest: {error}") from error


def install(catalog, name, workspace, archive=None):
    try:
        release = catalog["implementations"][name]
        expected = release["sha256"]
        if re.fullmatch(r"[0-9a-f]{64}", expected) is None:
            raise InstallError("implementation release has no qualified archive hash")
    except (KeyError, TypeError) as error:
        raise InstallError(f"unknown implementation: {name}") from error
    private = workspace / ".agenticu" / "implementations"
    private.mkdir(parents=True, exist_ok=True, mode=0o700)
    (private / ".gitignore").write_text("*\n")
    node, npm = ensure_node(private)
    destination = private / f"{name}-{expected}"
    receipt = destination / "installed.json"
    if destination.exists():
        manifest = admit_manifest(destination)
        if not receipt.is_file():
            raise InstallError("incomplete existing installation; inspect it before choosing a new workspace")
    else:
        with tempfile.TemporaryDirectory(dir=private, prefix="acquire-") as temporary:
            temporary = Path(temporary)
            source = archive
            if source is None:
                source = temporary / "release.tar.gz"
                fetch(release["url"], source)
            if digest(source) != expected:
                raise InstallError("implementation archive checksum mismatch; nothing executed")
            extracted = temporary / "implementation"
            extracted.mkdir(mode=0o700)
            with tarfile.open(source) as bundle:
                if any(not (member.isfile() or member.isdir()) for member in bundle.getmembers()):
                    raise InstallError("implementation archive contains links or special files")
                bundle.extractall(extracted, filter="data")
            manifest = admit_manifest(extracted)
            env = dict(os.environ, PATH=str(node.parent) + os.pathsep + os.environ.get("PATH", ""))
            run([str(npm), "ci", "--ignore-scripts", "--no-audit", "--no-fund"],
                cwd=extracted, env=env, stdout=sys.stderr)
            # npm must not rewrite the verified source or lock.
            admit_manifest(extracted)
            (extracted / "installed.json").write_text(json.dumps({"archiveSha256": expected}) + "\n")
            extracted.rename(destination)
    return {"implementation": name, "release": manifest["release"],
            "archiveSha256": expected, "source": manifest["source"],
            "node": str(node), "directory": str(destination),
            "entries": {key: str(destination / value) for key, value in manifest["entries"].items()}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name")
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--archive", type=Path, help="Use already downloaded bytes; the repository hash still applies")
    args = parser.parse_args()
    try:
        catalog = json.loads(CATALOG.read_text())
        print(json.dumps(install(catalog, args.name, args.workspace.expanduser().resolve(), args.archive), indent=2))
    except (InstallError, OSError, ValueError, tarfile.TarError) as error:
        parser.exit(1, f"implementation acquisition: {error}\n")


if __name__ == "__main__":
    main()
