import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { Schema } from "effect";

import { applyCommandPolicy } from "../vcs-command-policy.js";

// Codex owns the remaining exec options; preserve them when rewriting cmd.
const ExecInput = Schema.StructWithRest(
  Schema.Struct({
    cmd: Schema.String,
    shell: Schema.optional(Schema.NullOr(Schema.String)),
    login: Schema.optional(Schema.NullOr(Schema.Boolean)),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)]
);

const Request = Schema.Struct({
  session_id: Schema.String,
  turn_id: Schema.String,
  agent_id: Schema.optional(Schema.String),
  agent_type: Schema.optional(Schema.String),
  transcript_path: Schema.NullOr(Schema.String),
  cwd: Schema.String,
  hook_event_name: Schema.Literal("PreToolUse"),
  model: Schema.String,
  permission_mode: Schema.Literals([
    "default",
    "acceptEdits",
    "plan",
    "dontAsk",
    "bypassPermissions",
  ]),
  tool_name: Schema.Literals(["exec_command", "functions.exec_command"]),
  tool_input: ExecInput,
  tool_use_id: Schema.String,
});

const decodeRequest = Schema.decodeUnknownExit(Schema.fromJsonString(Request), {
  onExcessProperty: "error",
});

const deny = (reason) => ({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: reason,
  },
});

export const evaluateCodexRequest = (stdin) => {
  const decoded = decodeRequest(stdin);
  if (decoded._tag === "Failure") {
    return deny(
      "Invalid Codex PreToolUse request: expected the pinned exec_command contract."
    );
  }

  const request = decoded.value;
  const result = applyCommandPolicy(request.tool_input.cmd);
  if (result.action === "block") {
    return deny(result.reason);
  }

  // No permissionDecision:allow: Codex does not support it and normal host
  // permissions must still apply after the command rewrite.
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      updatedInput: { ...request.tool_input, cmd: result.command },
    },
  };
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(
    `${JSON.stringify(evaluateCodexRequest(readFileSync(0, "utf8")))}\n`
  );
}
