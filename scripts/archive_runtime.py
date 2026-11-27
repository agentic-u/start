"""Archive only admitted release files with reproducible, nonpersonal headers."""
import argparse
import gzip
from pathlib import Path
import tarfile

from tools.runtime import admit_release


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    directory = args.release.resolve()
    _, _, files = admit_release(directory)
    sources = sorted([directory / "manifest.json", *files])
    with args.output.open("xb") as destination:
        with gzip.GzipFile(filename="", mode="wb", fileobj=destination, mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT) as archive:
                for source in sources:
                    entry = archive.gettarinfo(source, arcname=source.name)
                    entry.uid = entry.gid = entry.mtime = 0
                    entry.uname = entry.gname = ""
                    entry.mode = 0o644
                    entry.pax_headers = {}
                    with source.open("rb") as stream:
                        archive.addfile(entry, stream)


if __name__ == "__main__":
    main()
