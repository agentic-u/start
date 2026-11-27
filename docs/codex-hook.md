# Codex command hook

The project registers `.codex/hooks.json` for Codex's native `PreToolUse` event on `exec_command`. Install the repository dependencies first. The hook resolves the repository root from the invocation directory and runs `scripts/hooks/codex-pre-tool-use.mjs` with Node.

The stdin boundary admits Codex's event envelope and the owned `cmd`, `shell` and `login` fields once with Effect Schema. Other exec options remain intact. The shared `scripts/vcs-command-policy.js` decides whether the command bypasses Git hooks. A rejection becomes native `hookSpecificOutput.permissionDecision: deny`. An accepted command becomes `updatedInput`, including noninteractive Git editor settings when applicable. It does not grant execution permission; Codex's normal permission checks still apply. Nested shell `-c`/`-lc` command strings are inspected by the shared policy.

## Activation

Codex CLI 0.166.0 has the stable hooks feature enabled, but project configuration trust and individual hook review are separate requirements. Open Codex in this repository, accept the ordinary project trust dialog if presented, then open `/hooks`, choose `PreToolUse`, inspect this project command and trust it. Review again when Codex marks the command configuration modified. No global config, stored trust hash or bypass flag is installed by this repository.

This checkout had no persisted project hook trust at implementation time. The adapter's real stdin subprocess tests passed; a trusted Codex tool invocation has not been demonstrated. Registration is not active enforcement until that review has happened. Verify both a denied bypass and an ordinary neighboring command in that trusted session before claiming host coverage.

## Scope and evidence

Run `node --test scripts/hooks/codex-pre-tool-use.test.mjs`. The tests invoke the actual adapter process with native stdin, exercise direct and nested shell bypass commands, check valid neighboring commands, preserve shell/tool options, and deny malformed payloads. They never execute the test command strings.

This is command policy for `exec_command`, not a security sandbox. It does not cover interactive `write_stdin`, arbitrary programs executing Git internally, other tool surfaces, shell startup files, or changes to the policy itself. Git's installed commit hooks remain the commit-time check. Codex's optional hook runner does not make missing Node/dependencies or a crashed adapter a fail-closed fence.

Upstream provenance: `openai/codex`, commit `c775dd3c332de1b69b25a4580f6c5bc44b94e284`, inspected locally:

- `codex-rs/hooks/schema/generated/pre-tool-use.command.input.schema.json`
- `codex-rs/hooks/src/schema.rs` (native output; no supported allow/ask decision)
- `codex-rs/hooks/src/events/pre_tool_use.rs` (input/output semantics)
- `codex-rs/hooks/src/engine/discovery.rs` (project discovery and hash trust)
- `codex-rs/hooks/src/engine/command_runner.rs` (stdin and invocation cwd)
- `codex-rs/config/src/hook_config.rs` (registration representation)
- `codex-rs/core/src/config/config_loader_tests.rs` (project trust behavior)
- `codex-rs/core/src/tools/handlers/unified_exec.rs` (`cmd`, shell and login)
- `codex-rs/core/src/hook_runtime.rs` (native tool request construction)
- `codex-rs/tui/src/slash_command.rs` and `bottom_pane/hooks_browser_view.rs` (`/hooks`)

The source pin establishes the inspected contract; it is not proof that the installed executable was built from that exact commit.
