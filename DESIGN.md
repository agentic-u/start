# Contract and implementation

The caller gives a signed-in agent the repository URL and either asks for setup or describes current business work. BOOTSTRAP.md routes the actual request: resume existing work, use a repository capability, or prepare a new workspace. Existing business work does not require a new folder, onboarding manifest or repeated interview. For new setup the agent owns preparation and handoff; the person never needs to name a path or operate a terminal. The existing sourced-picture/first-action/checkpoint session remains the new-workspace path.

The recipient worlds start without assuming any prior AgenticU onboarding. The business exists; relevant tools/access may or may not already work. A running file-capable agent is the lab floor, not proof that the business is connected or fitted. The selected capability drives inspection and progressive setup; the agent does not require a general initiation before helping with the requested job. Fictional-business runs now exercise this arrival path, fresh-agent continuation, missing mailbox access and one actual scheduled resumption; EVIDENCE.md keeps the tested revisions, remaining task-maintenance gap and limits explicit.

Distinguishing failure: after saving the first story, kill the conversation before picture.md exists. A fresh thread in the registered project must read the exact saved story, identify the pending question and continue without asking the story again. Repeated setup must not overwrite the folder or register a duplicate project.

## Interfaces

### The CLI is a staff interface

Ryan, 2026-11-26: "i will never ever touch the cli" and "it's for you it's as my staff 100% you interface for me if i need something from it etc".

The person describes what they need in conversation. Staff discovers and invokes the runtime through CLI, MCP, HTTP or code mode, reads the resulting receipts and explains the result in the person's terms. Never make operating a terminal, choosing commands, preparing input files or interpreting raw runtime output part of the person's workflow. Documentation of commands is for staff, engineering and qualification.

When a workflow needs a person's input or authority, staff presents the concrete question, artifact, scope and consequence in conversation or an appropriate human surface. The runtime's approval boundary still applies: a principal label or instructions in an input file are not authority. Staff translates an actual authorized decision through the supported host interface. A demonstration using fictional approval is not the person's acceptance of real work.

Walkthroughs for the person start with what they ask, what staff does underneath, what they receive, and any decision only they can make. Show commands as inspectable implementation evidence when useful; never assign terminal homework or ask which CLI command they want to drive.

### Staff discovery and continuity

The 2026-11-26 pre-Atlas UX audit exercised a fresh Sol staff user against fictional isolated state, real harmless Git observations and the public catalog. It found that bulk schema discovery printed 641,343 bytes and root help printed 8,635 bytes, including code-mode declarations in the command list. The CLI host now projects the existing operation registry as a compact `catalog` map, `catalog --operation NAME` for one exact input/output/failure contract, and explicit `catalog --full` for bulk integration export. No second domain schema or contract owner is introduced. Code-mode's full contract remains available through that exact-operation path; root navigation uses a short description. File-input help explains schema discovery and approval, and unknown/invalid invocation input points back to the relevant contract without echoing payloads or replacing domain failure guidance.

The CLI README teaches that runtime's engineering lifecycle: recover original receipts and unfinished jobs before working, retrieve scoped instructions during work, and save progress and a concrete handoff before leaving. Generated workspace instructions now use the repository capability path instead of automatically selecting that runtime. Principal input and decisions stay in conversation or the appropriate human surface. The runtime audit and remaining source/release gaps are in UX-REVIEW.md. Runtime source changes require a newly versioned qualified bundle before runtime consumers receive them; the immutable 0.1.0 release is not silently updated.

The runtime is a separate engineering interface, not a bootstrap/capability dependency. Its explicit installation entry remains `python3 tools/runtime.py install --release DIRECTORY --house BUSINESS_ROOT`; RUNTIME.md defines the immutable bundle and receipt. Existing runtime artifacts are preserved, but their presence does not instruct a new recipient to use them. Bootstrap, setup and generated workspace instructions now consistently exclude automatic runtime installation/invocation.

### Repository capabilities without the runtime

The 2026-11-27 commercial acquisition extension composes two ordinary repository skills: `launch-measured-funnel` and `measure-commercial-journey`. Donors are the internal source-based persuasion, minimal-offer-launch, causal-tracking and launch/readout methods, not another principal's credentials, account IDs, offer or outcome claims. Tools are fitted locally; no SDK/CLI architecture is imposed. Current qualification and the preceding fixed-revision fictional business/operator-transfer run are separated in EVIDENCE.md.

Launch draft-2 records the actual owner-assisted provider seam: immutable release and hashes, explicit account/resource scope, a separate configuration overlay, native receipts and ongoing query/update responsibility without transferring administrative credentials. Actual quota denial remains a missing means; it does not authorize billing changes or another project. This procedure is derived from work in progress, not qualification of a generic provider bridge or autonomous account administration.

Ryan, 2026-11-26, corrected a proposed direct handoff outside the repo: “everything the recipient does should... be downstream of the git repo.” README.md leads to BOOTSTRAP.md, which routes relevant work through CAPABILITIES.md into the versioned skill and its companion requirements/fitting instructions. `capabilities/recover-opportunities` is the first draft. The agent performs the declared dependency walk using ordinary authorized tools. Its private readable capability lock records selected local implementations, observations, authority references and unresolved needs; it is not an automatically enforced resolver or compatible wire serialization for runtime state. Native CRM/tasks remain the owner of cases where practical.

The Agent Skills carrier follows `agentskills/agentskills` at `83021e2be457a9b6679148719c1f6074f0ad975e` (Apache-2.0 specification/reference library). Frontmatter, validator source and tests were inspected; author-side validation passed. No upstream code was copied and the validator is not a recipient prerequisite. Prior AgenticUdotsurf `2916b54b` file-carrier/installation evidence and Spellbook `20d2cfd` binding alternatives inform the protocol; their behavioral checks, serializers and runtimes are not imported. The method is newly authored and has not been exercised by a recipient sales run. No onboarding or business-result qualification is inferred from publishing these instructions.

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
