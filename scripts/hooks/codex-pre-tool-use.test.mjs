import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import { NONINTERACTIVE_VCS_ENV } from "../vcs-command-policy.js";
import { evaluateCodexRequest } from "./codex-pre-tool-use.mjs";

const request = (cmd) => ({
  session_id: "fictional-session",
  turn_id: "fictional-turn",
  transcript_path: null,
  cwd: "/fictional-business",
  hook_event_name: "PreToolUse",
  model: "gpt-6.1-sol",
  permission_mode: "default",
  tool_name: "exec_command",
  tool_input: {
    cmd,
    shell: "/bin/zsh",
    login: false,
    tty: true,
    yield_time_ms: 1000,
  },
  tool_use_id: "fictional-tool",
});

test("native stdin denies actual bypass spellings, including shell flags", () => {
  for (const cmd of [
    "git commit --no-verify -m change",
    "git commit -am change -n",
    "/bin/zsh -lc 'git commit --no-verify -m change'",
    "env LEFTHOOK=0 git commit -m change",
    "git -c core.hooksPath=/dev/null commit -m change",
    "git config core.hooksPath /dev/null",
    "rm .git/hooks/pre-commit",
  ]) {
    const child = spawnSync(
      process.execPath,
      [new URL("./codex-pre-tool-use.mjs", import.meta.url).pathname],
      {
        input: JSON.stringify(request(cmd)),
        encoding: "utf8",
      }
    );
    assert.equal(child.status, 0, child.stderr);
    const output = JSON.parse(child.stdout).hookSpecificOutput;
    assert.equal(output.permissionDecision, "deny", cmd);
    assert.match(output.permissionDecisionReason, /Blocked hook bypass/);
  }
});

test("valid neighbors retain shell options and host permission authority", () => {
  for (const cmd of [
    "git commit -m '--no-verify is documentation'",
    "git log -n 1",
    "git config --get core.hooksPath",
    "git commit -m change && git status --short",
  ]) {
    const input = request(cmd);
    const output = evaluateCodexRequest(
      JSON.stringify(input)
    ).hookSpecificOutput;
    assert.equal(output.permissionDecision, undefined, cmd);
    assert.deepEqual(output.updatedInput, {
      ...input.tool_input,
      cmd: NONINTERACTIVE_VCS_ENV + cmd,
    });
  }
  const input = request("cat .git/hooks/pre-commit");
  assert.deepEqual(
    evaluateCodexRequest(JSON.stringify(input)).hookSpecificOutput.updatedInput,
    input.tool_input
  );
});

test("boundary rejects malformed JSON and wrong host/input contracts", () => {
  for (const input of [
    "{",
    "null",
    JSON.stringify({ tool_input: { cmd: "git status" } }),
    JSON.stringify({ ...request("git status"), tool_name: "Bash" }),
    JSON.stringify({ ...request("git status"), tool_input: { cmd: 4 } }),
    JSON.stringify({
      ...request("git status"),
      tool_input: { cmd: "git status", login: "false" },
    }),
  ]) {
    assert.equal(
      evaluateCodexRequest(input).hookSpecificOutput.permissionDecision,
      "deny"
    );
  }
});
