# Sources and exercised scope

Checked 2026-11-27. This is newly authored integration guidance; no app source or
vendor skill/recipe implementation is copied into this repository. The office app
is proprietary, all rights reserved. Link to its official distribution and use its
installed skill/API. The tldraw JavaScript SDK is a distinct product/license.

- Official [README](https://github.com/tldraw/tldraw-office/blob/f0c746465ce51692c24bfb4414e7250efa70f2cb/README.md),
  pin `f0c746465ce51692c24bfb4414e7250efa70f2cb`: app purpose, platforms, local
  portable files, Homebrew route, agent work and license.
- Official [stable release v1.25.0](https://github.com/tldraw/tldraw-office/releases/tag/v1.25.0),
  published 2026-11-26T16:43:16Z, verified through GitHub's live release API.
  Search-cached pages still described v1.24.0; do not select installer versions
  from a search snippet. The release provides universal/architecture-specific macOS
  DMG/ZIP, Windows x64/Arm64 installers, Linux x64/Arm64 AppImages and x64 Debian.
  Select the live asset and its published digest; this task did not download or
  install those packages.
- Official [agent setup](https://office.tldraw.com/docs/agents),
  [custom behavior](https://office.tldraw.com/docs/tools),
  [file scripts](https://office.tldraw.com/docs/scripts),
  [connectors](https://office.tldraw.com/docs/connectors) and
  [integration keys](https://office.tldraw.com/docs/integration-keys).
  The current manual is client-rendered. Its served SiteRoute module was inspected
  for the authored menu/setup and script/connector guidance; links remain the
  public entry, not copied site code.
- Installed v1.25.0 application and its live `/readme`: local authenticated API,
  document ownership, script-workspace/watch/save semantics, custom React shape
  import map, shared-board writer rules and service connector/key separation.
  Live recipes were read through the supported `/api/search` interface.

## What was actually exercised

The existing Mac app was already installed and running. Its installed version
read as 1.25.0. The new helper successfully read the per-launch discovery record
without printing its token, performed authenticated `/api/search`, listed open
document metadata and retrieved the selected live recipe descriptions/bodies.
Existing boards were not edited; no report was invented before the economic/source
requirements were recovered.

A later private qualification created a new local founder workbench from a
fictional report and precomputed scenarios supplied by the independent reporting
agent/Python evaluator. Durable custom-shape scripts showed the full supplied
hierarchy, source clocks, attribution/cost gaps, row metrics/lineage and additional
views. An actual DOM scenario control changed the displayed attributed-subset
result from $44 to $41.50 without changing original gross observations. An arbitrary
$4.25 unit-cost request remained labelled uncalculated and left the last result
unchanged. Base was restored, the app saved the document, watcher/runtime were
clean and layout lints were empty. A canvas screenshot was inspected. The canvas
contains no economic evaluator; it formats externally calculated results.

No clean-machine installation, Windows/Linux execution, fresh-harness registration,
live provider refresh, office-server connector, multiplayer behavior, reopened-file
behavior or cross-user adoption is qualified. Chosen scenario persists in the shape;
unsubmitted input drafts and the initial pending-request notice are per-client UI
state. A workflow needing a later receiver to carry that request must persist it.
