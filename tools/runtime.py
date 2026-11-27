#!/usr/bin/env python3
"""Install a checked public runtime bundle without changing agent configuration."""
import argparse
from dataclasses import asdict, dataclass
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile

NODE_VERSION = "26.13.1"
ENTRY = "node_modules/@agentic-u/cli/dist/main.js"


class InstallError(Exception):
    pass


@dataclass(frozen=True)
class Checkpoint:
    schemaVersion: int
    release: str
    releaseDirectory: str
    manifestSha256: str
    node: str
    npm: str
    prefix: str
    entry: str
    status: str


def read_checkpoint(path):
    try:
        value = json.loads(path.read_text())
    except (OSError, ValueError) as error:
        raise InstallError(f"cannot read runtime checkpoint; original retained: {error}") from error
    fields = set(Checkpoint.__dataclass_fields__)
    if (not isinstance(value, dict) or set(value) != fields or value["schemaVersion"] != 1
            or any(not isinstance(value[key], str) or not value[key] for key in fields - {"schemaVersion"})
            or value["status"] not in {"installing", "installed"}
            or not component(value["release"])
            or re.fullmatch(r"[0-9a-f]{64}", value["manifestSha256"]) is None
            or any(not Path(value[key]).is_absolute() for key in {"releaseDirectory", "node", "npm", "prefix", "entry"})):
        raise InstallError("malformed runtime checkpoint; original retained")
    return Checkpoint(**value)


def write_checkpoint(path, state):
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, delete=False) as file:
            temporary = Path(file.name)
            file.write(json.dumps(asdict(state), indent=2) + "\n")
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)
    except OSError as error:
        raise InstallError(f"cannot save runtime checkpoint; previous retained: {error}") from error
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def compatible_node(node):
    result = run([str(node), "--version"], capture_output=True)
    match = re.fullmatch(r"v26\.(\d+)\.(\d+)\s*", result.stdout)
    return match is not None and tuple(map(int, match.groups())) >= (13, 1)


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def component(value):
    return isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", value) is not None


def admit_release(directory):
    manifest = directory / "manifest.json"
    try:
        value = json.loads(manifest.read_text())
    except (OSError, ValueError) as error:
        raise InstallError(f"cannot read release manifest: {error}") from error
    if not isinstance(value, dict) or value.get("schemaVersion") != 1 or not component(value.get("release")):
        raise InstallError("unsupported manifest schema or release name")
    packages = value.get("packages")
    if not isinstance(packages, list) or len(packages) != 9:
        raise InstallError("release must contain exactly nine packages")
    if any(not isinstance(record, dict) or not isinstance(record.get("file"), str) or not record["file"].endswith(".tgz") for record in packages):
        raise InstallError("package records require tgz filenames")
    install_files = value.get("installFiles")
    if (not isinstance(install_files, list) or len(install_files) != 2
            or any(not isinstance(record, dict) or not isinstance(record.get("file"), str) for record in install_files)
            or {record.get("file") for record in install_files} != {"package.json", "package-lock.json"}):
        raise InstallError("release requires package.json and package-lock.json install files")
    files = []
    for package in packages + install_files:
        if not isinstance(package, dict):
            raise InstallError("invalid package record")
        name, expected = package.get("file"), package.get("sha256")
        if not component(name) or (not name.endswith(".tgz") and name not in {"package.json", "package-lock.json"}) or name in files:
            raise InstallError("artifact filenames must be unique package basenames")
        if not isinstance(expected, str) or re.fullmatch(r"[0-9a-f]{64}", expected) is None:
            raise InstallError("invalid package SHA256")
        path = directory / name
        if path.is_symlink() or not path.is_file() or digest(path) != expected:
            raise InstallError(f"package hash mismatch or missing file: {name}")
        files.append(name)
    return value["release"], digest(manifest), [directory / name for name in files]


def run(args, **kwargs):
    try:
        return subprocess.run(args, check=True, text=True, **kwargs)
    except (OSError, subprocess.CalledProcessError) as error:
        raise InstallError(f"command failed: {args[0]}: {error}") from error


def node_platform():
    system = {"Darwin": "darwin", "Linux": "linux"}.get(platform.system())
    machine = {"arm64": "arm64", "aarch64": "arm64", "x86_64": "x64", "AMD64": "x64"}.get(platform.machine())
    if system is None or machine is None:
        raise InstallError("supported platforms: macOS/Linux arm64/x64")
    return f"{system}-{machine}"


def fetch(url, destination):
    # Use the host's TLS trust configuration; standalone macOS Python can lack CA roots.
    run(["curl", "--fail", "--location", "--silent", "--show-error",
         "--proto", "=https", "--proto-redir", "=https", "--max-time", "120",
         "--output", str(destination), url])


def ensure_node(runtime):
    target = node_platform()
    existing = shutil.which("node")
    if existing:
        if compatible_node(existing):
            # A version-manager shim resolves to its dispatcher, not Node's bin directory.
            actual = Path(run([existing, "-p", "process.execPath"], capture_output=True).stdout.strip())
            npm = actual.parent / "npm"
            if npm.is_file():
                return actual, npm
    local = runtime / f"node-v{NODE_VERSION}-{target}"
    if not (local / "bin/node").is_file():
        base = f"https://nodejs.org/dist/v{NODE_VERSION}/"
        archive_name = f"node-v{NODE_VERSION}-{target}.tar.gz"
        with tempfile.TemporaryDirectory(dir=runtime) as temporary:
            temporary = Path(temporary)
            archive, sums = temporary / archive_name, temporary / "SHASUMS256.txt"
            fetch(base + "SHASUMS256.txt", sums)
            fetch(base + archive_name, archive)
            expected = [line.split()[0] for line in sums.read_text().splitlines() if len(line.split()) == 2 and line.split()[1] == archive_name]
            if len(expected) != 1 or digest(archive) != expected[0]:
                raise InstallError("official Node archive checksum mismatch")
            with tarfile.open(archive) as bundle:
                # The data filter also rejects absolute links and escaping links.
                bundle.extractall(temporary, filter="data")
            extracted = temporary / local.name
            if not (extracted / "bin/node").is_file():
                raise InstallError("Node archive lacks expected executable")
            extracted.rename(local)
    if not (local / "bin/npm").is_file() or not compatible_node(local / "bin/node"):
        raise InstallError("local Node runtime is incomplete or incompatible")
    return local / "bin/node", local / "bin/npm"


def install(release, house):
    version, manifest_hash, packages = admit_release(release)
    runtime = house / ".agenticu/runtime"
    runtime.mkdir(parents=True, exist_ok=True)
    receipt = runtime / "runtime.json"
    if receipt.exists():
        previous = read_checkpoint(receipt)
        if previous.releaseDirectory == str(release) and previous.manifestSha256 == manifest_hash and previous.status == "installed":
            if Path(previous.entry).is_file() and Path(previous.node).is_file() and compatible_node(previous.node):
                return asdict(previous)
    node, npm = ensure_node(runtime)
    destination = runtime / "releases" / f"{version}-{manifest_hash}"
    destination.mkdir(parents=True, exist_ok=True)
    state = Checkpoint(1, version, str(release), manifest_hash, str(node), str(npm), str(destination), str(destination / ENTRY), "installing")
    write_checkpoint(receipt, state)
    for artifact in packages:
        shutil.copyfile(artifact, destination / artifact.name)
    env = dict(os.environ, PATH=str(node.parent) + os.pathsep + os.environ.get("PATH", ""))
    run([str(npm), "ci", "--prefix", str(destination), "--no-audit", "--no-fund"], env=env, stdout=sys.stderr)
    if not (destination / ENTRY).is_file():
        raise InstallError("installed bundle lacks CLI entry")
    state = Checkpoint(**(asdict(state) | {"status": "installed"}))
    write_checkpoint(receipt, state)
    return asdict(state)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    setup = commands.add_parser("install")
    setup.add_argument("--release", type=Path, required=True)
    setup.add_argument("--house", type=Path, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(install(args.release.resolve(), args.house.expanduser().resolve()), indent=2))
    except (InstallError, tarfile.TarError) as error:
        parser.exit(1, f"runtime install: {error}\n")


if __name__ == "__main__":
    main()
