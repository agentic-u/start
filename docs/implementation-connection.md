# Existing implementations through starter

Ryan authorized this connection on 2026-11-27 after inspecting starter, Spellbook
and business-sdk. Original request: “connect the shit that exists and get a fresh
agent actually using it.” He also authorized coordination with the AgenticU
continuity/MIFGE owner to persist the accepted direction in House of Houses.
That owner's ADR/design records own the institutional meaning; this file owns
the implementation connection and its proof.

## Current connection

README → BOOTSTRAP → CAPABILITIES → selected method → IMPLEMENTATIONS → pinned
release → existing implementation → private local fitting → actual work/checks
→ retained handoff. The optional AgenticU runtime is not on this dependency path.

Spellbook remains the implementation source owner. Its release packer selects
tracked source/docs/examples and the required workspace dependency closure, pins
external versions and writes an npm lock. npm workspace realpaths preserve Node's
native TypeScript execution: installing the source directly under node_modules
would fail Node's prohibition on stripping dependency TypeScript. No implementation
code is copied into starter. Source pin and file hashes travel in the release.

Starter owns the distribution selection and private acquisition entry. It reuses
tools/runtime.py's checked Node acquisition, without installing the AU runtime.
Archive identity comes from the versioned implementations.json, not from an
untrusted manifest fetched beside arbitrary bytes. Each manifest entry and source
file is checked before package installation, whose lifecycle scripts are disabled.
No credentials or owner business material travel in the release.

Upstream implementation reused: the existing runtime installer and its tests at
agentic-u/start 67c06c18c20b19a4ddcf365dfb219e98cb336851; Python tarfile data-filter
extraction and tempfile lifetime; npm's package-lock/ci and workspace links. The
Spellbook packer records its own release/consumer qualification. This is a scoped
distribution connection, not a new business-state or work-state owner.

## Acceptance

Ryan's subsequent steering: if tools or clerical duties stall useful work, stop
that run, preserve it, simplify the entry and start fresh. The recipient gets the
outcome, original sources, usable access and repository entry. Qualification capture
is the coordinator's job. Keep software only when it improves the principal's
desired result; do not require a ledger/report as a substitute for useful work.

The ordinary entry must let a fresh agent acquire and execute the actual existing
code without the private source checkout, hidden coordinator instructions, copied
authentication or a mandatory general onboarding. Qualify useful successful work,
a meaningful refusal/recovery, and a fresh successor from retained records. Keep
original sources, full run records, first outputs and assistance. Installed code,
local simulation, live provider operation, principal acceptance and commercial
outcomes remain distinct claims.

False completion signals include a link to private code, successful package
installation without useful execution, fixture outputs presented as owner work,
a funnel preview called complete commerce, or a coordinator silently deploying
and repairing the recipient's work. Ten minutes is a product target, not observed
timing. Exact executed revisions and remaining gaps belong in EVIDENCE.md.
