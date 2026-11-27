# Contract and implementation

The actual caller is a signed-in T3 user sending only the repository URL and "set me up". The agent owns setup and the handoff; the person never needs to name a path or run a terminal command. Start by checking the environment, then ask readiness and the business name. Make one business folder, durable source/checkpoint files and a registered T3 project before the long owner conversation. End with a sourced picture, one approved useful action and a fresh-thread return.

Distinguishing failure: after saving the first story, kill the conversation before picture.md exists. A fresh thread in the registered project must read the exact saved story, identify the pending question and continue without asking the story again. Repeated setup must not overwrite the folder or register a duplicate project.

## Interfaces

The common runtime entry is `python3 tools/runtime.py install --release DIRECTORY --house BUSINESS_ROOT`. The public bundle's `manifest.json` admits nine unique tarball basenames plus required `package.json` and `package-lock.json` install files and their SHA256 values once. All eleven files are copied to the manifest-specific runtime prefix before `npm ci` installs the release's locked dependencies. Runtime artifacts live under `.agenticu/runtime`, with an interruption checkpoint and absolute node/CLI paths. Node 26.13.1 is downloaded from nodejs.org with its official SHA256 list only when a compatible Node 26/npm pair is absent. No website checkout, global installation, agent configuration replacement or onboarding-completion claim follows from installing tools. RUNTIME.md defines the bundle and receipt.

Agent reads BOOTSTRAP.md, clones this public repository into a separate tools folder and uses Python 3's standard library (no pip dependencies):

```
python3 tools/workspace.py init --name 'Example Business'
python3 tools/workspace.py status --root /absolute/business/folder
python3 tools/workspace.py answer --root /absolute/business/folder --file /path/to/exact-owner-answer.txt
python3 tools/workspace.py checkpoint --root /absolute/business/folder --phase listening --question 'What else?'
python3 tools/workspace.py handoff --root /absolute/business/folder
```

The append-only events journal owns owner answers and progress. Checkpoint JSON and said.md are derived views, reconstructed by status after an interrupted write. Business facts and approvals are not inferred from phase. The agent writes picture.md and business.json from sources; checkpoint only says where the conversation is. No legacy state readers or speculative migrations.

Git is local main, no global identity changes, no remote or automatic business-data publication. Public bootstrap/tools live outside the business folder. Existing folders require an existing valid checkpoint, otherwise setup refuses. Project-local Codex defaults do not replace a user's whole config. T3 gets its supported t3.json; model choices use actual T3 configuration controls because model is not a t3.json field.

## Upstream pass, 2026-11-26

- T3 Code `b99dab9495e68c4b118c062a9a46d09c154aadaa`, MIT: `docs/user/t3-json.md`, `apps/server/src/project/T3ProjectFileLoader.ts` and `.test.ts`, `ProjectService.test.ts`. Adopt native `t3 app PATH` for idempotent registration/opening, `defaultThreadEnvMode: local`, and supported project actions. Installed CLI help and real app opening were independently exercised in the Mac lab. No private database writes or invented model keys.
- OpenAI Codex local source `c775dd3c332de1b69b25a4580f6c5bc44b94e284`, Apache-2.0: `codex-rs/core/src/config/mod.rs` project trust and config loading; current main discovery `b9e830fb986ae478ce59c3c97408bdfa1bd5ddab`. Adopt project-scoped defaults; do not assert a file was loaded without verifying effective settings. Never silently change project trust, sandbox or approval policy.
- Anomaly Browse `ce5578e8bbd2e62b0016293ceb02c0202fd78053`, MIT: `install`, `rust/crates/browse/src/agents.rs`, `install.rs` tests and `test/isolated/agent-relay-code-exchange.ts`. Adopt the official native installer and config-preserving Codex MCP registration. Native install needs no Node; npm launcher does. Pairing and a real tab test are separate gates. Keep relay loopback and never copy browser profiles or credentials.
- Existing AgenticU draft bootstrap 2026-11-26.2 supplied the owner conversation. Original synthetic Mac run proved business folder, exact source saving, 21 matched drafts and completed-session return; exposed missing early-interruption instructions and manual project handoff. This repository replaces the bootstrap delivery for new tests; historical evidence remains with the original lab.

No third-party source code is copied into this repository. Python's filesystem, subprocess and JSON primitives cover the small local boundary; a framework would add prerequisites without improving this caller.
