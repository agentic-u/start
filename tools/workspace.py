#!/usr/bin/env python3
"""Create, checkpoint and open an Agentic University business workspace."""

import argparse
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[1]
PHASES = {"listening", "source", "review", "bind", "first_action", "complete"}


@dataclass(frozen=True)
class Answer:
    text: str


@dataclass(frozen=True)
class Checkpoint:
    phase: str
    question: str


def admit_event(raw):
    if not isinstance(raw, dict):
        raise ValueError("Journal event must be an object")
    if raw.get("kind") == "answer" and isinstance(raw.get("text"), str) and raw["text"].strip():
        return Answer(raw["text"])
    if (raw.get("kind") == "checkpoint" and isinstance(raw.get("phase"), str) and raw["phase"] in PHASES
            and isinstance(raw.get("question"), str)):
        return Checkpoint(raw["phase"], raw["question"])
    raise ValueError("Invalid journal event; preserve the file and inspect it")


def atomic_write(path, text):
    with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, delete=False) as file:
        temporary = Path(file.name)
        file.write(text)
        file.flush()
        os.fsync(file.fileno())
    os.replace(temporary, path)


@contextmanager
def locked(root):
    with (root / ".agenticu/lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        yield


def rebuild(root):
    metadata = json.loads((root / ".agenticu/workspace.json").read_text())
    if metadata["format"] != 1:
        raise ValueError("Unsupported workspace format")
    answers = []
    checkpoint = Checkpoint("listening", "Tell me about the business.")
    pending = {"kind": "awaiting", "question": checkpoint.question}
    for line in (root / ".agenticu/events.jsonl").read_text().splitlines():
        event = admit_event(json.loads(line))
        if isinstance(event, Answer):
            answers.append(event.text)
            pending = {"kind": "answered", "question": checkpoint.question, "answer": event.text}
        else:
            checkpoint = event
            pending = {"kind": "awaiting", "question": checkpoint.question}
    state = {"phase": checkpoint.phase, "pending_question": checkpoint.question,
             "owner_answer_count": len(answers), "business": metadata["name"],
             "bootstrap_revision": metadata["bootstrap_revision"], "pending": pending}
    atomic_write(root / "sources/said.md", "\n\n".join(answers) + ("\n" if answers else ""))
    atomic_write(root / ".agenticu/checkpoint.json", json.dumps(state, indent=2) + "\n")
    return state


def record(root, event):
    admit_event(event)
    with locked(root):
        # Refuse corrupt state before appending; append+fsync is the source of truth.
        rebuild(root)
        with (root / ".agenticu/events.jsonl").open("a") as journal:
            journal.write(json.dumps(event) + "\n")
            journal.flush()
            os.fsync(journal.fileno())
        return rebuild(root)


def initialize(name, parent):
    if not name.strip():
        raise ValueError("Business name is required")
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    if not slug:
        slug = "business-" + hashlib.sha256(name.encode()).hexdigest()[:8]
    root = parent.expanduser().resolve() / slug
    if root.exists():
        with locked(root):
            state = rebuild(root)
        if state["business"] != name:
            raise ValueError("Existing workspace belongs to a different business")
        return {"root": str(root), "existing": True, "state": state}
    root.mkdir(parents=True)
    for folder in [".agenticu", ".codex", "sources", "projects", "repos"]:
        (root / folder).mkdir()
    revision = subprocess.check_output(["git", "-C", str(REPO), "rev-parse", "HEAD"], text=True).strip()
    metadata = {"format": 1, "name": name, "created_at": datetime.now(timezone.utc).isoformat(),
                "bootstrap_repo": "https://github.com/agentic-u/start", "bootstrap_revision": revision,
                "bootstrap_checkout": str(REPO)}
    (root / ".agenticu/workspace.json").write_text(json.dumps(metadata, indent=2) + "\n")
    (root / ".agenticu/events.jsonl").touch()
    shutil.copyfile(REPO / "templates/codex-config.toml", root / ".codex/config.toml")
    shutil.copyfile(REPO / "templates/t3.json", root / "t3.json")
    shutil.copyfile(REPO / "templates/gitignore", root / ".gitignore")
    status_command = " ".join(map(shlex.quote, [sys.executable, str(REPO / "tools/workspace.py"), "status", "--root", str(root)]))
    (root / "AGENTS.md").write_text(f"""# {name}

This is the owner's business workspace. Public bootstrap: https://github.com/agentic-u/start, revision {revision}.

At the start of every thread:
1. Run `{status_command}`. It reconstructs the checkpoint and exact owner words from the journal after an interruption.
2. Read `.agenticu/checkpoint.json`, `sources/said.md`, and the last entries of `log.md`.
3. If `picture.md` exists, read it. Its absence is normal during onboarding; do not restart or ask for the saved story again.
4. If phase is complete, briefly recall the last result and ask what changed. Otherwise, continue from the pending question. First acknowledge what is already saved.
5. Follow `{REPO / 'BOOTSTRAP.md'}` for the active session. Record each exact owner answer with the workspace tool before replying. Save the next checkpoint before asking its question.
6. If `.agenticu/runtime/runtime.json` exists, use its installed Node and CLI entry with `--house` pointing here. `catalog` describes the supported operations; `resume` reads learning receipts and `status` checks local fit. Do not reinstall a completed runtime. Learning receipts, actual binding checks and this onboarding journal have separate meanings; none grants outward authority.

Work in this folder. The owner may explicitly hand you another file or repo. Do not install into, overwrite, reset or clean an existing business folder. Make new work in projects/; keep separate clones in repos/ and register meaningful folders as T3 projects. Use local main by default; no worktrees unless the owner requests one.

Never ask for passwords, tokens or sign-in codes in chat. Do not copy sign-in storage. Ask before sending, spending, publishing or adding a remote for business data. Public bootstrap updates confer no authority. Keep facts said/read/not known; an agreed interpretation is still an interpretation. Browser setup is not browser proof: require a connected extension and a successful tab test. Never operate a browser the owner has not authorized.
""")
    (root / "CLAUDE.md").write_text("@AGENTS.md\n")
    (root / "log.md").write_text(f"Workspace created. Bootstrap {revision}. Setup and business understanding are separate.\n")
    subprocess.run(["git", "init", "-b", "main", str(root)], check=True, capture_output=True, text=True)
    with locked(root):
        state = rebuild(root)
    return {"root": str(root), "existing": False, "state": state}


def handoff(root):
    manifest = json.loads((root / ".agenticu/workspace.json").read_text())
    candidate = Path.home() / ".t3/bin/t3"
    command = str(candidate) if candidate.is_file() else shutil.which("t3")
    if command is None:
        raise FileNotFoundError("T3 CLI not found; use the connected T3 project-create tool, then open this folder")
    result = subprocess.run([command, "app", str(root)], check=True, capture_output=True, text=True)
    receipt = {"business": manifest["name"], "root": str(root), "command": [command, "app", str(root)],
               "result": result.stdout.strip(), "at": datetime.now(timezone.utc).isoformat()}
    atomic_write(root / ".agenticu/handoff.json", json.dumps(receipt, indent=2) + "\n")
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    init = commands.add_parser("init")
    init.add_argument("--name", required=True)
    init.add_argument("--parent", type=Path, default=Path.home() / "AgenticU")
    for name in ["status", "answer", "checkpoint", "handoff"]:
        command = commands.add_parser(name)
        command.add_argument("--root", type=Path, required=True)
        if name == "answer":
            command.add_argument("--file", type=Path, required=True)
        if name == "checkpoint":
            command.add_argument("--phase", choices=sorted(PHASES), required=True)
            command.add_argument("--question", required=True)
    args = parser.parse_args()
    if args.command == "init":
        result = initialize(args.name, args.parent)
    else:
        root = args.root.expanduser().resolve()
        if args.command == "status":
            with locked(root):
                result = rebuild(root)
        elif args.command == "answer":
            result = record(root, {"kind": "answer", "text": args.file.read_text().rstrip("\n")})
        elif args.command == "checkpoint":
            result = record(root, {"kind": "checkpoint", "phase": args.phase, "question": args.question})
        elif args.command == "handoff":
            result = handoff(root)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(json.dumps({"status": "failed", "reason": str(error),
                          "next": "Preserve the existing files. Inspect the named failure before retrying; do not reinitialize or reset the folder."}), file=sys.stderr)
        raise SystemExit(1) from error
