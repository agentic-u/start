# Staff experience before the Atlas test

Audit date: 2026-11-26. Baseline source: 9aa4c91. One independent Sol staff user and the coordinating agent exercised ordinary commands against fictional isolated private state, the live public catalog and harmless local Git observations. No Atlas onboarding, real account participation, browser pairing, trust activation or external business write was performed. This is runtime usability qualification, not customer acceptance.

## What was found

| Finding | Observed behavior | Repair owner |
| --- | --- | --- |
| Context-heavy discovery | `catalog` emitted 641,343 bytes; only the full catalog exposed complex input shapes. Root help emitted 8,635 bytes and embedded code-mode declarations. | CLI host: compact operation map, one exact contract with `--operation`, explicit bulk `--full`, short navigation descriptions. |
| Silent lost-job risk | A saved `waiting_input` job was absent from `resume` and `status`; `job_show` required already knowing its ID. | Jobs: list unfinished jobs with revisions and next legal operations. |
| Impossible binding advice | Checking authored public needs told staff to bind an endpoint even though no executable adapter existed. | Local fitting: identify unsupported checks before asking for a binding. |
| Poor recovery at waits | `Cannot resume waiting_input.` did not identify `job_input`; invalid input only said it did not match the schema. | Jobs: state-specific recovery. CLI: exact-contract discovery hint on invalid input. |
| Missing storage looked broken | Reading an absent job before the jobs database existed returned a storage error. | Jobs: distinguish absent store/job from corrupt or unavailable storage without creating a database. |
| Inconsistent workflow IDs | Acquisition accepted a short workflow ID, but reading the saved bundle with that same ID failed. | Bundles: consistent workflow identity admission. |
| Doomed starts | A nonexistent progress attempt could start a job; only later review failed on the missing reference. | Jobs: admit the attempt reference before saving the job. |

The coordinating parent owns the local/bundle/job changes and their focused regressions. CLI discovery and lifecycle guidance are the other coherent change batch. The shared candidate must pass the owning repository's checks; findings are not claimed fixed merely because a patch exists.

## Still open for content/interface work

- Curriculum text links to web paths such as `/learn/what-good-looks-like.md`, while `read` expects `lesson:what-good-looks-like`. The document has no canonical lesson references to follow. Add those references in the publisher or explicitly admit route aliases; do not make an agent infer IDs from source code.
- Whole-workflow `read` duplicates the structured workflow in `document.text`. The observed answer-with-a-receipt response was 17,757 bytes. Preserve complete original instructions and provenance, but choose a scoped structured/default representation and an explicit original-text retrieval path when changing that contract. `read --step` already gives an effective scoped path.
- Search matches literal words and requires all terms. `find "grow sales"` was empty while `find sales` returned two documents. Teach fewer-word recovery and eventually provide a no-results hint; this does not require inventing semantic search.
- The general job adapter checks exact Markdown headings and literal evidence strings. It does not provide model judgment or general workflow execution. Ordinary missing input is represented in a `failure` field even when the job is merely waiting; staff should read the status and next legal action rather than call that a broken job.
- The browser binding adapter remains unsupported. Optional participation and scoped grant administration are library/service surfaces, not ordinary CLI operations. Do not imply they are ready through a label or a successful Git check.

## Qualification and release boundary

The existing CLI/MCP/HTTP parity, private authority, receipts and scoped instruction behavior should remain intact. New discovery checks use an unavailable public catalog path to prove that help and contract discovery require neither network access nor private state. Exact-operation schema output is compared with the full registry projection so the smaller path cannot drift into a second contract.

The published runtime-v0.1.0 archive predates these changes. A new versioned bundle, cold package-consumer qualification and release coordination are required before shipping the new source to public users. This audit does not republish an immutable release, deploy the site or restart the principal's deferred onboarding tests.
