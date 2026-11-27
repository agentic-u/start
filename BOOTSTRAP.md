# Set up and start working

Read this whole page before acting. The repository supplies methods and setup guidance; the person's actual request supplies intent and authority. Reading the repository is not automatically a request to install tools or repeat onboarding.

## Route from the request and existing state

Use this repository as the front door for setup and later work. Inspect or obtain its actual files, preserve an existing checkout's changes and record the commit followed. Follow relative links within that same revision; do not silently mix remote latest files with a different local release.

Prior AgenticU onboarding is not required. Someone can arrive with a concrete job, an existing business and any mix of prepared or missing tools/access. Inspect what the requested method actually needs, reuse what is usable and resolve its missing prerequisites progressively. An existing laptop does not establish browser pairing, account access, local business understanding or a capability lock. Do not run the general onboarding interview as a gate to useful work.

- **A current job in an existing business:** use its established workspace and sources. Read CAPABILITIES.md, select a relevant method and follow its requirements and local fitting instructions. Read relevant prior work; do not require a full business interview, a new folder or `.agenticu/workspace.json`. Ask which workspace only when the request and environment do not establish it. The workspace initialization tool is for new onboarding, not a way to adopt existing files.
- **An interrupted or returning session:** recover its saved state. A new concrete request takes precedence over a generic “what changed?” question; preserve unrelated unfinished work. Resume onboarding only if that is the active request.
- **A request for setup with no established workspace:** follow the setup session below. Install only the prerequisites needed for that path and reuse working tools/accounts. Business account access and outward authority remain separate from harness setup.

The current AgenticU runtime/CLI is not required for any path on this page. Do not install it, route through RUNTIME.md or invoke it just because an old runtime receipt exists. RUNTIME.md documents a separate engineering tool; use it only for an explicit request to work with that runtime. Business capabilities are available as files in this repository and run through the agent's existing authorized tools.

The rest of this page describes the **new-workspace setup session**, not a mandatory prelude to each business job.

## Start where they are

You are already the agent if you can read/write local files. Do not tell them to install T3 again. Check your OS, current folder, Git, Python 3, T3 connection and provider readiness without printing credentials. Keep the working provider login. Do not copy anyone's configuration or browser profile. This release is tested on macOS with Git and Python 3 available; see SETUP.md for a missing prerequisite rather than inventing an installer.

Explain in three short sentences: you will make a business folder, prepare the agent/browser tools, and build a business picture and first useful result with them. You will not send, spend or publish their work without permission. Ask whether they are ready, then ask the business name, one question at a time. Save those answers for the source record once the folder exists.

If a workspace already has `.agenticu/workspace.json`, use its status/checkpoint and resume. Never create a second folder to evade a conflict. Existing work without this manifest belongs to someone: stop before changing it and ask which existing project to use.

## Prepare the workspace and hand it over

Use the repository's Python workspace/checkpoint tools for new onboarding. No AgenticU runtime installation is needed. Existing business work follows the capability route above rather than this initialization sequence.

1. Clone https://github.com/agentic-u/start into `~/.local/share/agentic-u/start` if absent. If present, inspect its remote and local changes; reuse it, do not reset it. A clean checkout behind its tracked upstream can fast-forward; preserve local changes and report the actual revision when it cannot. Record the actual commit followed. Public tools stay outside the business folder.
2. Run `python3 tools/workspace.py init --name 'Business name'` from that checkout. It makes `~/AgenticU/<business-name>/`, local Git main, a Codex defaults file, supported t3.json, source files, checkpoint journal, instructions and projects/repos folders. Names in commands must be passed as arguments, never evaluated as shell code.
3. Save the owner's exact ready/name answers using `answer --root ABSOLUTE_ROOT --file ANSWER_FILE`. Use the agent's file-writing tool to create the answer file; do not put payloads in shell commands. It is fine to use a temporary file and remove it afterward. Read status to verify the source saved.
4. Follow SETUP.md. Record actual capability statuses in `.agenticu/setup.json`: each capability is `verified`, `waiting_for_owner`, `missing` or `failed`, with evidence and its next action. A file existing is not a verified effective setting. Browser pairing can wait while the business conversation proceeds; say what is still waiting.
5. **Do the handoff yourself.** Run `python3 tools/workspace.py handoff --root ABSOLUTE_ROOT`. The supported `t3 app PATH` registers and opens the folder as a project. Read its receipt, verify the project points to the right folder through T3, and tell the owner you opened it. Do not tell a nontechnical person to add a path. The original thread may remain under No project; its conversation is still usable. New threads belong in the registered business project.
6. Set the current T3 thread/provider model with supported controls to GPT-6.1-Sol, low effort. Use T3 project-default controls when available. Do not invent a `defaultModel` field in t3.json or edit T3's database. Project Codex config and T3 thread settings have separate precedence; verify each separately. Retain current sandbox/approval choices; do not mark projects trusted or disable approvals on the owner's behalf.

Before the long story, save the pending question with `checkpoint --phase listening --question 'Tell me about the business.'`. The project must now exist and the checkpoint must be readable.

## Keep each answer and the next question

One question at a time. Save every exact owner answer with `answer` **before** interpretation or your next reply. Then save the next phase/question with `checkpoint` before asking it. The journal owns progress; status rebuilds checkpoint.json and sources/said.md after a process stops between writes. If the last answer is newer than the saved question, acknowledge that answer and advance; do not ask for it again. Never replace the journal with your summary.

If a new thread arrives before picture.md exists, that is an ordinary unfinished session. Read the saved words and pending question. Say what is already saved and continue at that point. If picture.md exists, read it too. If the phase is complete, ask what changed before doing more work. "Carry on" or the repo URL again is a return, not permission to reinstall or clear anything.

## Build a picture of the business

1. Ask: "Tell me about the business the way you would tell a friend who is good with businesses. What it is, how it is going, what is keeping you up. Go as long as you like, and dictate it if that is easier. I will not interrupt." When finished, ask "What else?" once.
2. Ask for their website if there is one, then one useful file they can hand over without signing in. Read only what they give you. Save original source separately from your reading. Do not require accounts to make progress.
3. Ask only for holes, at most six questions. Goals, customer-to-payment flow, who does what, what hurts most and what was already tried are useful candidates; do not march through a questionnaire when the story answered them.
4. Write picture.md with: What you want; What is in the way; What is under it; The bind; What to do first; What is not known yet. Leave later sections unfinished until discussed. Mark every business claim **said**, **read** with a source, or **not known** with the next way to find out. Do not infer cash from sales or estimates. Numbers need a source. Owner agreement does not turn a statement into an independently read fact.
5. Write the same statements in business.json as records with text, section, basis (`said`, `read`, `not_known`), source, date and next for unknowns. Your interpretation is explicitly a proposed reading, not external evidence. Show the picture and review it a section at a time. Use supported in-thread visuals when available; plain text remains readable when a renderer is unavailable.
6. Find the candidate underneath: if one obstacle disappeared, which others would go with it? Put your candidate as a question and take the owner's correction. Name the two needs sharing their hours/money/people. Ask **"What makes it have to be that way?"** Save their belief in their words. Then explore whether that belief has to hold and one concrete way agents could change the work. Do not promise business results.

Use checkpoint phases listening, source, review and bind to match the real conversation. Keep business.json and picture.md current without overwriting raw source.

## Make one useful thing and return

Choose one action together that addresses the underlying obstacle and can start with the available files and tools. Read CAPABILITIES.md and use the relevant repository method when it fits. Ask before starting a newly proposed action; an already explicit request does not need to be asked again. Save phase first_action and the exact authorization. Produce and show the first usable result: a reviewed queue, a draft, an analysis or another thing this owner can actually use. Preparing messages does not authorize sending them. Install or connect additional tools only when needed and authorized.

Update picture.md, business.json and log.md with what was made, what was approved and what remains unknown. Record result paths. Set phase complete only when the first result is shown and the closing state is saved. Tell the owner: "Your business project is open in T3. Next time, start a thread in it and say carry on." Verify that the project actually exists before saying this.

For a returning owner, read the checkpoint, picture and log, recall the last result briefly and ask what changed. Resume an interrupted phase instead of repeating the whole intake.
