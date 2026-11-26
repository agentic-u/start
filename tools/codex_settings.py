#!/usr/bin/env python3
"""Read effective project settings through Codex's supported app-server API."""

import argparse
import json
from pathlib import Path
import signal
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--binary", required=True)
parser.add_argument("--root", required=True, type=Path)
args = parser.parse_args()


def timed_out(signum, frame):
    raise TimeoutError("Codex config/read did not finish within 15 seconds")


signal.signal(signal.SIGALRM, timed_out)
signal.alarm(15)
process = subprocess.Popen([args.binary, "app-server"], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                           stderr=subprocess.PIPE, text=True)


def send(message):
    process.stdin.write(json.dumps(message) + "\n")
    process.stdin.flush()


def response(request_id):
    for line in process.stdout:
        message = json.loads(line)
        if message.get("id") == request_id:
            if "error" in message:
                raise RuntimeError(message["error"])
            return message["result"]
    raise RuntimeError("Codex exited before replying: " + process.stderr.read())


try:
    send({"id": 1, "method": "initialize", "params": {"clientInfo": {"name": "agenticu-start", "version": "0.1.0"}}})
    response(1)
    send({"method": "initialized"})
    send({"id": 2, "method": "config/read", "params": {"cwd": str(args.root.resolve()), "includeLayers": True}})
    result = response(2)
    keys = ["model", "model_reasoning_effort", "web_search"]
    # Do not print the whole config: other keys can contain secrets or personal settings.
    print(json.dumps({"settings": {key: result["config"].get(key) for key in keys},
                      "origins": {key: result["origins"].get(key) for key in keys}}, indent=2))
finally:
    signal.alarm(0)
    process.terminate()
    try:
        process.wait(timeout=3)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()
