# Reuse code when its contract fits

The [existing implementation release](../../IMPLEMENTATIONS.md) already includes
Spellbook Numbers, kernel money types, native-provider libraries and the agent
entry points. Acquire `spellbook` into the existing private workspace only when
that code helps the job; no AU runtime or private checkout is needed.

For chronology and covered financial feeds, read the installed
`packages/numbers/src/Window/README.md` and `Report.ts`. Its real CLI is
`packages/numbers/src/Window/cli.ts`; run it with the Node executable returned by
acquisition and one fitted input JSON file. It supports CashPeriod and
PurchaseCohort, source-specific clocks and Complete/Partial/Unavailable coverage,
native payment/refund references, known/unknown figures and cost allocation.

It is not a raw PostHog/Meta/merchant decoder or per-ad attribution engine.
Coverage is supplied evidence, not an independent live check. Its cohort contract
requires all-history cost coverage and explicit order allocation; do not fake
those to fit a calendar-day export. Its order identity must match the selected
source meaning. It does not preserve every cost-model assumption by itself.

The installed `packages/numbers/src/Bindings/DentiWise/README.md` describes a
source-qualified snapshot binding that deduplicates native feed identities. It
is not an already-deployed collector for a new merchant. Existing adapters or
small owner-specific query programs can fit the actual sources. Keep direct
native API/CLI/MCP calls and current schemas with the owning source, as METHOD.md
describes. A Python Decimal/SQL calculation over correctly joined facts can be
more useful than forcing the business through an unsuitable library shape.

Keep the source-specific adapter/calculation with the business, reusable machinery
with its code owner, and the presentation in the selected interface. Fit the
professional method; don't recreate the private DentiWise machine or promote a
fictional example's arithmetic into universal finance software.
