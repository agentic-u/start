# Agentic University start

This repository owns the public agent bootstrap, workspace templates and its checks. Work in this checkout, on main. Keep original owner material separate from interpretation. Public test evidence uses fictional businesses only; no credentials, personal paths, account identifiers or real business records.

Use existing T3, Codex and Browse interfaces. Never edit a T3 database or copy sign-in state. Keep setup/checkpoint facts separate from business understanding and human approval. Default ordinary tests to gpt-6.1-sol, low effort. A passing synthetic run is not customer acceptance.

Checks: `mise exec -- pnpm check`, `mise exec -- pnpm test`, and `mise exec -- pnpm acceptance:cold-install`. The check builds workspace declarations before checking consumers, so it works from a fresh clone. Python bootstrap checks remain `python3 -m unittest discover -s tests -v`. Then run the real fresh-agent and interrupted-agent paths before claiming onboarding works. Maintain DESIGN.md with upstream pins and behavior actually exercised. Commit checked changes to main.
