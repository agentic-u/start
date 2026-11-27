# Local lock and evidence — draft 1

This is a file-based working protocol, not a new runtime or a compatible serialization for an existing lock reader. It carries forward the existing manifest/local selection/readiness distinction and Spellbook's explicit binding alternatives. No custom CLI, database, resolver service or account is required. The agent follows the requirements and uses its ordinary authorized tools. No claim of mechanical enforcement follows from this prose.

## Locate or create the local record

Use an existing business-local capability record if it can express these facts; do not create a competing owner. Otherwise keep `capability.lock.md` in an agreed private business-local work directory. It is a readable document following the headings below. It may remain partially fitted. The word lock means selected method and local implementations, never whole-workflow readiness or proof of business results.

### Method

Record skill name, metadata revision, actual source location, exact installed Git commit when available, and SHA-256 of SKILL.md and each consulted companion. Use actual observations from ordinary Git/hash/file tools, not guessed values. If distribution identity cannot be established, mark it unresolved; retain the exact files used and do not claim a verified release. The run may be exploratory with this limitation visible. Do not substitute an upstream source commit for the installed package commit or silently update a method during a run.

### Selected implementations

One entry per requirement actually considered:

- Requirement name and draft revision; why this branch needs it.
- Selected tool plus account/workspace/project/endpoint identity and the exact source location or invocation. No tokens, passwords or credential bytes.
- State: **bound**, **choice**, **missing**, **unknown**, **waiting**, or **kept-out**. Bound records selection, not proof. Choice names the available alternatives and what decision is needed. Missing requires actual evidence of absence; unknown means it has not been established. Waiting records the exact unavailable action/input and who can supply it. Kept-out records an explicit exclusion and its source.
- Reference to the latest relevant observation, or explicitly **unchecked**.
- Reference to applicable authority, or explicitly **not established**.
- Any source coverage/meaning mismatch and what remains needed.

Reuse a fitting only after checking that its identity, scope and observations still apply. A copied file does not reproduce its account session or permission. Do not relabel waiting as bound because someone said setup will happen later.

### Dependencies and unresolved work

Record the active branch and its selected dependency order from requirements.md. Keep missing definitions, failed observations, owner-only facts/decisions/access and genuinely time-dependent waits explicit. Separate work blocked by each gap from independent work that can continue.

### Evidence and authority references

Point to the business's existing logs/records. If none suffice, use dated companion notes in the same private directory. An observation identifies the requirement, selected tool/account, check performed, timestamp, result (**passed**, **failed**, **inconclusive**) and actual evidence/location. Keep previous observations so another agent can see what changed. Check again after a relevant account, method, configuration, permission or business fact changes; check mutable availability at commitment time.

Authority identifies who authorized what, when, any conditions/limits and its original source. Reading, drafting, sending, price/scope changes and appointment commitments are distinct actions. Preserve genuine standing authority; ask only where absent or insufficient. The package, a connection test or a checked record cannot grant it.

## Changes and return

Update only the affected entries as new facts appear; preserve prior state through the business's normal history or dated snapshots. Shared edits require the existing tool's concurrency/version controls; this protocol itself supplies no lock against racing writers. On return, inspect the active cases and relevant changed sources; do not repeat every check or all onboarding without a reason. A method update is reviewed against local adaptations; private configuration and source material stay private and separate from public skill files.
