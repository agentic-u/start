# Install the public runtime

This is a separate engineering interface, not a prerequisite for bootstrap or repository capabilities. Follow this page only for an explicit request to work with the runtime. The current repository entry is BOOTSTRAP.md and its capability routing.

For such a request, both an existing agent and a fresh setup can use the same public release bundle. The installer needs Python 3.11.8 or newer on macOS or Linux (arm64 or x64). It does not need a website checkout, a global Node installation, or copied agent settings.

Get `agenticu-runtime-0.1.0.tar.gz` from the [official runtime release](https://github.com/agentic-u/start/releases/tag/runtime-v0.1.0) and extract it into a release directory. The bootstrap checkout supplies `tools/runtime.py`; the archive supplies the packages and their locked dependencies.

From this checkout, run:

```
python3 tools/runtime.py install --release /absolute/release-directory --house /absolute/business-folder
```

The release directory contains `manifest.json`, nine package tarballs, `package.json` and `package-lock.json`. The manifest has `schemaVersion: 1`, `release: "0.1.0"`, nine `packages` records, and exactly two `installFiles` records naming `package.json` and `package-lock.json`. Every record has `file` and `sha256` (64 lowercase hexadecimal characters). Filenames must be unique basenames; release names are single path components. The installer checks all eleven files before invoking npm. Obtain these files and the manifest from the official release together; checksums detect changed artifacts, not the identity of an arbitrary supplied manifest.

The installer reuses Node 26.13.1 or newer within major version 26 when its sibling npm exists. Otherwise it downloads Node 26.13.1 from nodejs.org, checks its official SHASUMS256 entry, and installs it inside the business folder. Unsupported platforms stop with a named error. Package dependencies may require internet access.

All eleven checked files are copied under `.agenticu/runtime/releases/VERSION-MANIFEST_SHA256/`. The installer runs `npm ci` there so the release lock controls transitive dependency versions and integrity. A changed manifest gets a separate directory, preserving the previous runtime if installation fails. The process changes PATH only for its own npm subprocess. It does not change global PATH, agent configuration, provider login, browser pairing, or business onboarding state.

Standard output is a JSON receipt with absolute `node` and `entry` paths. Start the CLI by executing that node path with the entry path as its first argument. `.agenticu/runtime/runtime.json` retains the same receipt and an `installing` or `installed` checkpoint, saved using a flushed temporary file and atomic replacement. Malformed existing checkpoint bytes are retained and reported as a failure. Repeating the exact command checks the supplied artifacts, executable version and CLI entry again and reuses a completed installation; an interrupted install retries from those same inputs. Installation alone does not prove provider readiness or completed business onboarding.
