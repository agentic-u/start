---
name: work-with-reporting-canvas
description: Give a principal and their agent a shared, editable reporting workspace in tldraw office, with tables, assumptions, controls and useful input/output behavior. Acquire the official desktop app when needed; keep economics and provider credentials in their owning services.
compatibility: A file-capable agent, tldraw office, and the app's installed agent skill/local API. The optional request helper needs Node with built-in fetch; another authorized HTTP client is equally usable.
metadata:
  revision: "draft-1"
---

# Build the reporting workspace with the principal

Start from the actual decision and existing data. Ask what the principal wants to
see or change, show a useful first view, and refine it together. Do not make the
person learn tldraw's scripting model, configure an agent framework, or complete a
technical interview before useful work. This capability supplies the interface;
the selected economic method owns calculations, joins and what can be claimed.

## Get the real app and agent access

tldraw office is the current name of tldraw offline. Check for an existing app and
working local API before installing anything. Keep existing files and scripts.
For a missing installation, use the official [download](https://office.tldraw.com)
or [stable releases](https://github.com/tldraw/tldraw-office/releases/latest).
Read the current [installation instructions](https://office.tldraw.com/docs/install)
and select the actual OS/architecture. The official macOS alternative is
`brew install --cask tldraw` when Homebrew is already available; do not make
installing Homebrew a prerequisite. Use the platform's normal installer, preserving
an existing installation and settings. Verify the downloaded release identity and
published checksum before running it. Do not substitute the tldraw JavaScript SDK,
the website, a third-party fork, or the nightly channel for this desktop app.

Open the app and read its live API `/readme`. A file/HTTP-capable agent can use
that interface directly; it does not need a new harness or conversation. Read the
installed tldraw skill when present. For native automatic skill discovery, the
Welcome window has **Install agent skills**; the app menu has
**Develop → Install Agent Skills** (under ≡ on Windows/Linux). Use the existing
authorized native app controls, or ask for that specific click if unavailable.
The [agent setup](https://office.tldraw.com/docs/agents) supports Codex, Claude Code,
Cursor, Gemini CLI, Antigravity and Pi. Official setup says restart the agent to
load its registration. Do that only when the new harness registration is needed;
do not discard an existing conversation to perform an available HTTP operation.

The local API's `/readme` owns current endpoint details. Its port/token discovery
file is `tldraw/server.json` under the user's platform application-config folder.
The app's installed helper manages this. A small optional [file-body request
helper](canvas-api.mjs) also reads discovery afresh and never prints the token:

```
node capabilities/work-with-reporting-canvas/canvas-api.mjs POST /api/search --file capabilities/work-with-reporting-canvas/inspect-app.js
```

Write JavaScript/JSON request bodies to files with the agent's file editor. Supply
their paths with `--file`; add `--json` for JSON bodies. Do not put scripts, JSON or
credentials in shell commands. The helper makes only loopback requests and accepts
`--server PATH` when discovery is explicitly fitted elsewhere. An unreachable port
with an old discovery file is a stopped app, not a reason to reset files or retry
another document.

## Compose the useful surface

Use the principal's named existing board only within their authorized scope. For
a new reporting workspace, create a named `.tldraw` document through the app's
`POST /api/docs/create` endpoint in the chosen private business folder. Do not
construct or modify the archive on disk. Record its actual returned ID and inspect
its ownership; a different open file is never a substitute for a missing target.

Choose the lightest useful presentation. Static tables, labels and source notes
can be ordinary shapes. An interactive table, editable scenario inputs, a chart or
export control can be a custom React/HTML shape registered in `script/config.js`,
with behavior in `script/main.js`. The app supplies its own tldraw/React imports;
this is not a general Node application or a new npm installation. Read the live
recipes for custom shapes, clickable controls and durable scripts. The companion
`read-reporting-recipes.js` retrieves those current recipes through `/api/search`.

Make the important distinction visible at the point of use: observed amounts,
estimated costs, scenario assumptions, missing joins and unavailable conclusions.
Keep each displayed margin paired with its actual denominator and cost basis. A
margin before extra reserves cannot silently label a dollar result after them.
Let the principal adjust assumptions and choose a useful grouping or date/cohort
view. A changed assumption produces a separately labelled scenario; it does not
rewrite original provider observations. Let tables expand to the actual hierarchy
and rows the job needs. Do not impose a small canned dashboard or invent numbers
to make a table look complete.

Keep provider extraction, sensitive joins and authoritative calculations in their
owning process. A board can render a prepared private data snapshot; the snapshot's
source window, completeness and uncertainty travel with it. Secrets never belong
in shapes, script files or snapshots. A live authenticated service can be fitted
separately. On an office-server board use its supported connector/key mechanism,
which keeps keys server-side. Do not install a team server merely to show a local
report, or treat a local-file script as if it had server connectors or Node access.

Scripts and imported snapshots are retained in a `.tldraw` file and may be shared
with it. Include only the data the principal intends that file to contain. File
content also reaches the agent under that provider's terms; a local app does not
make a cloud model local. Network sharing is a separate decision.

## Leave an interface the principal can use

Use `/script-workspace` for durable behavior and edit only its declared script
sources. Read a pre-existing script before extending it. A one-shot `/exec`
listener disappears on reopen. For shared files, registration renders everywhere
but shared writes/refreshes must be host-owned; otherwise every participant can
repeat them. Follow the live shared-board recipe.

Verify a consequential input/output once: change a scenario input, inspect the
correctly labelled result, and restore or retain the principal's chosen value.
An uncalculated request must remain visibly distinct from the last calculated
result; accept arbitrary assumptions without manufacturing a new answer. Persist
an explicit pending request when a later agent or reopened document must carry it.
Check the watcher applied the script, fix actual runtime/layout errors, and save
a locally owned document through `helpers.saveDoc()` from a one-shot exec. Remote
and server boards have different saving owners; respect them. Never edit open
`.tldraw` archives or their app-owned database/working files directly.

Return the useful report and how to open or refresh it. Keep provenance and
qualification behind the work rather than assigning the principal a ledger or
audit report. App installation, API access, a working control, correct economics,
provider refresh and the principal's acceptance are separate observations.
