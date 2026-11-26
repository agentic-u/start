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

## Second principal: volunteer food pantry

2026-11-26, unchanged functional bootstrap `93cc6e838d547a229271de8d81f376d763c1ba38`, GPT-6.1-Sol low. A genuinely new No project thread received only the bare repository URL, with no setup verb, persona or prescribed result. The fictional principal was frozen separately before entry: a volunteer pantry coordinator with a day job, no employees, revenue or growth goal, no appetite for a dashboard, and explicit household-privacy boundaries. Subsequent answers were natural owner responses, not instructions to follow the repository's interview template. No bootstrap changes were made during the run.

The first attempted entry was invalid as a fresh-principal test: the warm account still had an active previous workspace and the agent resumed it. Before the actual rerun, prior T3 registries, business roots, scratch folders and provider session/index state were archived privately. Existing provider authentication and model/MCP preferences were retained in place. The installed binaries and browser pairing remained. This is a clean post-auth application/workspace test on a warm Mac, not a factory-new installation.

Observed results:

- The agent accepted the non-business context and adapted its questions rather than imposing a sales intake. It created and automatically opened the pantry project; the story continued in that project.
- The owner's initial hypothesis was better reminders. An anonymous incident note exposed conflicting advertised hours, an earlier hall closing time and late-shift households unable to arrive before closing. The agent distinguished communication errors from physical access, asked who could confirm hours, and questioned whether personal Wednesday collection was a rule or merely existing practice. It accepted the owner's correction against promising deliveries or extra volunteer time.
- It made an actual one-page Letter PDF handover, shown and opened inside T3. Independent PDF metadata, text and rendered-page inspection confirmed one readable page, explicit unconfirmed hours, no agreed late-shift alternative, Spanish review still required, and no household histories or ID collection. This is a discussion draft, not an agreed collection arrangement.
- The simulated owner accepted it for discussion, with no sending or agreement of arrangements. Closing checkpoint reached complete with the hall reply pending. All nine saved answers matched the actual T3 user messages once each in the journal and source record.
- A new project thread received only **carry on**. It recalled the draft, retained the unconfirmed arrangements and no-send boundary, and asked whether the hall or volunteers had replied. It did not repeat intake or setup.

Failures and limits are part of this result:

- **Browser readiness false negative:** the agent checked the default relay port and recorded browser access missing. An independent check of the already configured helper port found the extension connected. The business conversation proceeded, but autonomous technical setup qualification did not fully pass. This run does not establish effective Codex-default verification either; the agent left it unverified.
- **Input harness defect:** Atlas typing flattened the incident note's paragraph breaks before T3 received it. The agent saved exactly the flattened user message. Eight other answers matched their frozen input files exactly. The original note is retained separately; this run does not prove byte-preserving file ingestion. Future multiline delivery must be checked before submission or supplied as a file.
- The driver briefly treated T3's starting state as finished. It was corrected afterward to wait through starting and running; final evidence was collected only after completed readback. No answer was resent.

Raw persona, inputs, transcripts, reset ledger, audit script, collected artifacts and screenshots remain private in the owning checkout's ignored `.local/run-002/` and the Atlas collection store. This is a second synthetic first-session and completed-session-return test, not a second early-interruption test, a real volunteer's acceptance or proof that households received food.
