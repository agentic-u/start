---
name: work-with-recordings
description: Make an existing recorded work session searchable and cuttable by aligning recordings, transcripts and agent logs, then export an authored edit to a page or editor timeline.
compatibility: A file-capable agent; Node 26 and the pinned tape implementation. Media inspection needs ffmpeg/ffprobe. Inputs and generated stores remain private.
metadata:
  revision: "draft-1"
---

# Work with the actual session

Acquire the `spellbook` implementation through ../../IMPLEMENTATIONS.md. Read the
included `packages/tape/SKILL.md`, README.md and declaration schema. Use the `tape`
entry from the install receipt. No paid media service or model API is embedded.

Recover the person's intended audience and outcome, source recording locations,
available transcripts, actual agent logs, recording clocks and publication holds.
Retain originals. Do not claim Codex or another log format is supported just because
the agent understands it; inspect the implementation's parsers. Missing transcripts
need an authorized transcription tool fitted separately. ffmpeg/ffprobe are separate
local prerequisites, not bundled services.

Build the declaration from actual files and run `build`, `check`, `find`, `at` and
`show` to recover useful material on one clock. Missing sources and unmeasured
offsets remain explicit. Create the editorial cut from what was actually said and
shown, using the author's goal and source context. The agent supplies that judgment;
search hits are not an edit. Retain exact source spans and first generated outputs.

Use `page` for an inspectable private cut and `otio` for a real editor timeline.
Check the output and source mapping. An OTIO file is not a rendered video; opening
in Resolve and rendering require the actual editor and further qualification.
Public export must honor declared holds and publication authority. Preserve the
full run and leave the declaration, store, authored cut and source paths intelligible
to the next agent. Report exactly what can be opened or edited now.
