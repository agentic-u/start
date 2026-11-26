import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1] / "tools/workspace.py"
spec = importlib.util.spec_from_file_location("workspace", SOURCE)
workspace = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = workspace
spec.loader.exec_module(workspace)


class WorkspaceTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.parent = Path(self.temp.name)

    def test_interrupted_before_picture_resumes_exact_source(self):
        result = workspace.initialize("Test Business", self.parent)
        root = Path(result["root"])
        workspace.record(root, {"kind": "answer", "text": "my exact story\nsecond line"})
        workspace.record(root, {"kind": "checkpoint", "phase": "listening", "question": "What else?"})
        (root / ".agenticu/checkpoint.json").unlink()
        (root / "sources/said.md").write_text("incomplete derived view")
        with workspace.locked(root):
            state = workspace.rebuild(root)
        self.assertEqual(state["pending_question"], "What else?")
        self.assertEqual((root / "sources/said.md").read_text(), "my exact story\nsecond line\n")
        self.assertFalse((root / "picture.md").exists())
        self.assertEqual(subprocess.check_output(["git", "-C", str(root), "branch", "--show-current"], text=True).strip(), "main")

    def test_repeat_keeps_existing_work_and_journal(self):
        root = Path(workspace.initialize("Test Business", self.parent)["root"])
        (root / "keep.txt").write_text("unfinished work")
        workspace.record(root, {"kind": "answer", "text": "owner's words"})
        result = workspace.initialize("Test Business", self.parent)
        self.assertTrue(result["existing"])
        self.assertEqual(result["state"]["owner_answer_count"], 1)
        self.assertEqual((root / "keep.txt").read_text(), "unfinished work")

    def test_existing_unrelated_folder_is_not_adopted(self):
        root = self.parent / "test-business"
        root.mkdir()
        (root / "keep.txt").write_text("existing")
        with self.assertRaises(FileNotFoundError):
            workspace.initialize("Test Business", self.parent)
        self.assertEqual(list(root.iterdir()), [root / "keep.txt"])

    def test_invalid_journal_is_preserved_and_refused(self):
        root = Path(workspace.initialize("Test Business", self.parent)["root"])
        journal = root / ".agenticu/events.jsonl"
        journal.write_text('{"kind":"invented"}\n')
        with self.assertRaises(ValueError):
            workspace.record(root, {"kind": "answer", "text": "new answer"})
        self.assertEqual(journal.read_text(), '{"kind":"invented"}\n')

    def test_answer_saved_before_next_checkpoint_is_not_an_unanswered_question(self):
        root = Path(workspace.initialize("Test Business", self.parent)["root"])
        workspace.record(root, {"kind": "checkpoint", "phase": "listening", "question": "Tell your story"})
        state = workspace.record(root, {"kind": "answer", "text": "already told you"})
        self.assertEqual(state["pending"], {"kind": "answered", "question": "Tell your story", "answer": "already told you"})


if __name__ == "__main__":
    unittest.main()
