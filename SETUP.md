# Prepare the agent's working environment

The agent performs these steps. Explain meaningful choices to the owner; do not turn them into a command-line operator. Setup evidence lives in the local business folder, never this public repo.

## Folders, Git and repositories

`~/AgenticU/<business>/` is the business T3 project and local Git repository on main. `sources/` holds original material and exact owner words. `projects/` holds useful work. `repos/` holds separate cloned repositories and is ignored by the parent Git repo. Public bootstrap tools live at `~/.local/share/agentic-u/start`.

Check `git --version`. If macOS prompts for Apple's command-line tools, installation needs the person's normal OS approval; this is a prerequisite waiting for the owner, not a successful Git check. Do not run Homebrew/Node installation to fix a broken npm Codex launcher; T3's managed native Codex works independently. Python 3 is required by this release's checkpoint tool; verify it actually executes. If it is missing, record the missing prerequisite and continue only with steps that do not depend on the tool. Do not claim durable onboarding ready before it runs.

Never set a global Git name/email. Ask which identity to use when a first commit requires it; project-local identity can use their supplied identity. Do not invent an email. Local Git creation needs no account. Adding a business-data remote needs the owner's explicit repository/visibility choice; default any newly authorized business remote to private. The bootstrap repository's public visibility says nothing about the business folder.

Reuse existing repositories in place when the owner points to them. Inspect status before changing them. Do not nest a new Git repository in an existing one or use worktrees unless requested. Register the business folder and meaningful independent project folders through T3's native project tools or CLI; read back the workspace root. Never inspect/edit the T3 SQLite database as a configuration interface.

## Codex and T3

The template `.codex/config.toml` sets only GPT-6.1-Sol, low reasoning and live web search. It is project-local and does not contain sign-in state. Codex may ignore project config until the person trusts the folder; do not silently change trust. A T3-selected model can override the file. Verify the current thread model through T3's configuration or CLI readback. Preserve sandbox, approvals, accounts, other MCP servers and existing user preferences.

Use `t3.json` for supported local-workspace defaults and project actions. The bootstrap does not prescribe a new environment-wide theme, notifications, full-access mode or approval bypass. Its handoff uses supported `t3 app PATH`; it must point at the owner's business folder, not the public bootstrap clone. Use actual Settings controls for project defaults not exposed by t3.json. Record which settings were effective versus merely written.

The Codex runtime may be managed by T3; prefer the functioning provider. Standalone `codex login status` can report disconnected when managed T3 auth is working. If testing a direct CLI provider, the helper/device must authorize its own login. Never copy another device's token or Codex home.

## OpenCode Browse (OCB)

OCB means Anomaly's **Browse**, not a requirement to install the OpenCode agent. Browse supports Codex directly. Prefer its native installer; Node is required only for npm/npx installation, not for the native binary.

Check whether browse already exists and run `browse status --json`. If missing, fetch the official installer to a local file from `https://opencode.ai/browse/install`, inspect it, then run it with `--agent codex --no-open --no-wait`. Its native download checks the release's size and checksum. Reuse the vendor installer/config writer instead of rewriting the user's entire TOML. Do not pipe an unexamined response straight to a shell. Record actual installed version.

Use `browse install --agent codex` to preserve existing Codex settings and register its MCP server. A fresh Codex/T3 session may be needed to load MCP tools; the native browse CLI can test an already running session. Keep the relay on 127.0.0.1. Pair only the intended, owner-authorized Chrome-family browser, never a host's unrelated profile. Do not use SunBrowser unless the owner explicitly authorizes that browser for the current task.

Separate macOS users share loopback ports. In a helper/test account, check for a relay belonging to the normal account before starting Browse. Use a separate supported port (for example `OPENCODE_BROWSER_PORT=19990`) for the helper's install/relay and let the vendor config writer record that environment for Codex. Never stop another account's relay or pair its browser into the helper. A refused pairing can be a different profile trying the wrong relay; it is not permission to reset that profile. Record the actual relay endpoint and browser identity in setup evidence.

Verify the pinned-port environment with `codex mcp get browse`. In tested Browse 0.1.5, rerunning install with a port reported "already has browse" but left that environment absent. For that observed failure, use Codex's native writer: `codex mcp add browse --env OPENCODE_BROWSER_PORT=19990 -- /absolute/path/to/browse mcp`, then read it back. Keep other MCP entries intact. Do not assume behavior on current upstream main is already in the installed stable binary.

Install the official Chrome Web Store extension: https://chromewebstore.google.com/detail/mfnicocicmmlkpjnaffgihfjhdgjkdjg . The browser's permission confirmation is a real owner step. If it cannot be completed with authorized control, record waiting_for_owner and show the exact step. Do not mark browser capability verified or silently substitute another browser. Continue the independent business conversation while it waits.

Qualification requires both connected-extension status and a real tab test: open https://example.com, read **Example Domain**, close that exact test tab, and verify it is gone. Record the browser/profile identity and evidence without pairing codes. A page renderer inside T3 does not prove control of the owner's signed-in browser. Later account sign-in, 2FA, payments, sending and publishing keep their own authority boundaries.

For browser tasks, follow the host harness's mandated browser when it has one; record a named unsupported/failure condition before switching. This bootstrap prepares OCB capability, it does not override the running harness's tools or grant account access.
