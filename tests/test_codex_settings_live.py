import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


@unittest.skipUnless(os.environ.get("CODEX_TEST_BINARY"), "set CODEX_TEST_BINARY for the real native config API check")
class CodexSettingsLiveTest(unittest.TestCase):
    def test_fill_preserves_existing_choice_and_mcp_then_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            codex_home = root / "codex"
            codex_home.mkdir()
            config = codex_home / "config.toml"
            config.write_text('model = "gpt-6.2-sol"\n\n[mcp_servers.keep]\ncommand = "keep-this-entry"\n')
            project = root / "business"
            project.mkdir()
            command = [sys.executable, str(Path(__file__).resolve().parents[1] / "tools/codex_settings.py"),
                       "--binary", os.environ["CODEX_TEST_BINARY"], "--root", str(project), "--fill-user-defaults"]
            environment = {**os.environ, "CODEX_HOME": str(codex_home)}
            first = subprocess.run(command, env=environment, capture_output=True, text=True, check=True)
            self.assertEqual(json.loads(first.stdout)["settings"], {
                "model": "gpt-6.2-sol", "model_reasoning_effort": "low", "web_search": "live"})
            saved = config.read_bytes()
            self.assertIn(b'[mcp_servers.keep]', saved)
            self.assertIn(b'command = "keep-this-entry"', saved)
            subprocess.run(command, env=environment, capture_output=True, text=True, check=True)
            self.assertEqual(config.read_bytes(), saved)
