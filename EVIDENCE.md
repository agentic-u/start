# Qualification record

2026-11-26. One synthetic macOS account-isolation run, Codex GPT-6.1-Sol low. This is developer qualification, not a customer's acceptance or a business result. Raw conversation, screenshots and account-specific paths are retained privately; no credentials or personal configuration are published here.

## Public URL and automatic handoff

A fresh T3 No project thread received only:

> read https://github.com/agentic-u/start and set me up

It read the public repository, checked prerequisites, asked the business name and cloned the tools. The fictional Juniper Paving workspace used bootstrap `7dc3e508bbe92a08258aa0c23f1f34967ee6f0bf`. The agent initialized local Git main, wrote Codex/T3 templates, made the projects/repos/source folders, saved the initial answers and executed the supported T3 handoff. T3 project readback matched the workspace. The owner's next story landed in the new business project, not the original No project thread. New project threads inherited GPT-6.1-Sol low.

The first test driver wrongly kept watching the original thread after this successful handoff; it subsequently failed when the app was closed. The story had already been saved once in the destination thread. The driver gained an explicit send-only mode: after a handoff, observe/discover the destination before choosing a thread to wait on. Never resend an answer because the old thread did not change.

## Early interruption and fresh-thread return

After the first story was saved, picture.md did not exist. T3 was closed, the derived checkpoint moved aside while the journal remained, and T3 reopened. Opening the same business project reused the same registration. A new thread received only **carry on**.

The agent reconstructed the checkpoint, recalled the existing story and resumed at **What else?** It did not ask for the business name or story again, create a second workspace, or require sign-in. Independent checks matched the three exact owner answers in the journal and said.md, each once; phase remained listening and the pending question remained What else. The picture was still absent. Later browser/setup-test answers are separate from this interruption snapshot.

## Browser and settings

- Official native Browse 0.1.5 installed without Node; Codex MCP registered with its supported writers. The account's Chrome extension required one human permission confirmation. This step is not represented as autonomous.
- Account isolation does not isolate loopback ports. Helper Browse was pinned to 127.0.0.1:19990, and its Codex MCP environment was read back. Browse 0.1.5's installer reported an existing MCP entry without adding the port; Codex's native MCP writer repaired that observed omission. Other account relays/browser profiles were not reset.
- Connected extension/protocol state verified. Both the operator and the actual T3 agent opened example.com through Browse, read page/title, closed the exact test tab and confirmed an empty test-tab list. The T3 agent separately closed its preview test tab and did not confuse preview rendering with extension control.
- Codex config/read initially returned no effective model/effort/web defaults because project config was untrusted. The native config/batchWrite API filled only absent user defaults: gpt-6.1-sol, low, live web search. Fresh readback identified user config as their source. Project trust and permission choices were preserved; the untrusted project layer remained disabled.
- The installed native Codex 0.166.0 passed the preservation check in a temporary CODEX_HOME: explicit gpt-6.2-sol stayed unchanged, an existing MCP entry stayed intact, missing effort/web defaults were filled, and the second run left the config bytes unchanged. No sign-in material was copied into that temporary home.

## Reproduce the executable checks

```
python3 -m unittest discover -s tests -v
CODEX_TEST_BINARY=/absolute/path/to/codex python3 -m unittest discover -s tests -v
```

Five filesystem/journal checks passed on the actual helper's native Python 3.9.6. With CODEX_TEST_BINARY pointing at Codex 0.166.0, all six checks passed. Without that variable the real-provider configuration test is explicitly skipped; it is not claimed by the five unit checks.

## Bounds

This tests a signed-in, warm Mac helper with Git/Python available, not a factory-new Mac or Windows. Extension permission and later account sign-ins remain owner steps. The updated setup/interruption path was exercised; the earlier draft's complete business conversation was independently exercised in the preceding synthetic run. This release does not claim a new real customer business outcome, phone setup, tldraw setup, or private-repository publishing. Those have separate needs and authority.
