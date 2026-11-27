# The operating reporting method

## Fit the actual business

Find the existing advertising source, analytics/tracker, merchant/payment records,
fulfillment evidence and original cost documents. This can be PostHog's synced
Meta tables, a native Meta CLI/MCP, store APIs or retained exports. Discover actual
table/property/operation names and access scope. Do not invent endpoints, assume
every provider field exists or require a new connector when existing access works.
For a new business choose sources from its own means and authority. DentiWise's
account IDs, SQL IDs, timezone, SKU prices and permissions do not travel.

The operating DentiWise report primarily reads its already-synced Meta tables,
executes the underlying PostHog SQL freshly, and supplements native merchant money
when the warehouse lags. This is one fitted implementation. Direct Meta reads,
warehouse extraction, presentation refresh, publication and recurring scheduling
are separate actions. Do not change production tracking, budgets, dashboards,
schedules or public reports while answering a read-only profitability question.

Pick the economic scope with the principal when ambiguous. Merchant proceeds,
affiliate earnings and a consolidated owner-funded-ad business have different
costs and entitlements. Internal commissions cancel only inside an actually
selected consolidated boundary; affiliate-funded media is not the merchant's
expense. State sales-tax and shipping-revenue treatment when it affects the result.

## Establish the populations and clocks

Choose explicit start/end bounds in the actual reporting timezone and an as-of
cutoff. A local day ends at the next local midnight, not automatically 24 hours
later. Keep complete days separate from today's partial day. Acquisition click
day, native sale day, refund day, source extraction and knowledge time differ.
An upsell or refund can arrive after the original acquisition day.

Record each source's actual extraction and native coverage/cutoff, including
pagination and filters. A successful fetch, callback time or cached insight does
not establish completeness. Read required columns and scoped records progressively;
do not dump a whole warehouse into agent context. Native Meta outbound/link clicks,
analytics journeys, visits, checkout gestures and merchant charges are distinct
populations. Journey IDs are not people. A URL ad tag or fbclid alone does not
prove that a browser visit was paid human delivery. Don't invent bot exclusions.

## Recover and test the joins

Trace native receipt → explicit tracking carrier or admitted native relation →
ordered browser/tracker context → native account/ad/parents. Inspect source URLs
as well as event properties; a real carrier may be preserved in the URL. Check
placeholder macros, QA/test exclusions and conflicting parent/ad carriers. Confirm
the ad identity against the native ad source rather than a creative name.

Preserve provider + merchant account + native transaction identity. Compare full
relevant financial facts when API and warehouse exports overlap; select one native
record, never add both copies. A changed or conflicting copy requires resolution.
Native paid status, currency/mode, refunds, fees and seller proceeds govern money;
browser checkout, accepted upsell or platform-reported purchases do not.

Keep four useful conclusions distinct:

- **verified:** exact source-supported relation and consistent native identities.
- **absent in the inspected complete scope:** the declared complete sources contain
  no usable relation for these records; name that scope and cutoff.
- **conflicting:** several candidate relations disagree; don't choose a maximum,
  latest timestamp or convenient match.
- **unknown:** access, schema, pagination, retention or source coverage is inadequate
  to decide. State precisely what evidence is missing.

Never join on email, name, IP, amount/time proximity, product alone or resemblance
of creatives. A customer/billing-history grouping is not automatically an order,
person or acquisition root. Carry frontend attribution to upsells only through a
verified native relation under a declared rule; conflicting direct upsell context
must not be overwritten. One frontend plus one paid upsell is two charges and one
frontend purchase, not proof of two buyers or even a unique person.

No join does not mean no useful report. Show native spend, merchant totals, the
verified attributed subset and unassigned money. Explain the smallest actual fix:
recover an existing carrier, inspect native metadata, correct a conflicting map,
or prospectively instrument a missing handoff with authority. New instrumentation
cannot recover historical attribution by itself. Statistical allocation is a
separate explicitly labeled estimate, never repaired exact attribution.

## Model the money and physical work

Prefer native merchant fee/payout fields and reconcile their semantics. Use either
gross minus its fees/commissions or native seller proceeds, not both deductions.
Separate original gross, refunds/chargebacks, net revenue, seller proceeds, cash
settlement and contribution. Cost credits and returned fees have signs. Deduct a
refund once; refunded goods can still incur original product/shipping costs.

Recover the SKU/package crosswalk, units and actual shipment/parcel relationships.
Paid product units are not proved shipped/billed units. Several charges can ship
in one parcel; one charge can have multiple shipments. Count a supplier invoice
line once, then allocate its exact amount by an explicit conserving policy when
needed. Prior balances are not the current invoice. A postage average multiplied
by charges is an estimate, not actual fulfillment cost. Reshipments, returns,
variable support and settlement fees may be separate variable costs.

Use dated, scoped cost observations and currency. A historical invoice can inform
an estimated unit rate without proving today's billed order cost. Unknown SKU,
parcel allocation or cost class stays unknown. Withhold the affected complete
contribution; retain its known components and any clearly named covered subset.
Do not invalidate unrelated otherwise qualified scopes. Keep reserves, transfers,
fixed overhead, tax and financing distinct from the selected contribution boundary.

For the selected scope:

`contribution after ads = qualified revenue − selected revenue losses − external
variable costs − owned media spend`

Every cost/assumption carries its actual/estimated/scenario meaning. Define the
margin denominator (gross or net revenue); it is undefined at zero. Cost-complete
observed contribution, estimated contribution and a prudent future reserve are
different answers. Missing required costs cannot be silently omitted to certify
the first. Known zero needs real source coverage or an explicit applicable policy.

## Produce the founder's view

Start with the useful table and decision. A strong default is account → campaign
→ ad set → ad, with parent subtotal immediately before children and overall once.
Retain spend-only and attributed zero-spend rows; don't silently lose native money
because a spend-led query omitted an ad. Keep unassigned money and unavailable
source rows separate. Sum native leaves once and recompute every parent ratio.

Show requested columns where supported: spend, impressions/pooled CPM, outbound
CTR, cost(count) at meaningful funnel steps, frontend and paid-upsell revenue in a
compact split, FE/UP counts, paid-frontend CPA, basket AOV, gross ROAS, estimated
contribution dollars/percent and the coverage/assumptions needed to read them.
Compare yesterday/today and campaign-to-date only on clearly named populations.
Percentage change is undefined when its prior denominator is zero.

Add package economics: frontend-only and verified linked-upsell basket value,
observed/modelled variable costs, pre-ad contribution per supported acquisition,
break-even CPA and the allowable CPA at a requested target contribution. Historical
linked-upsell value is not guaranteed future LTV; immature refund cohorts and
different acquisition mixes need explicit treatment. A scenario is not a forecast
that today's winning ad will scale at the same CPA or AOV.

Reconcile merchant gross = assigned + unassigned, selected spend against its source,
deduplicated records, refund and cost allocation conservation, and parent/leaf
totals. Use integer minor units/decimal arithmetic; show the source cutoffs and
material unknowns beside the result. Reuse suitable existing typed libraries and
query tools, with the same semantics. No fixed two-table schema is the definition
of this capability. A source-specific extractor may need real adaptation.

The agent may produce Markdown, CSV, SQL, a service or an interactive tldraw board
with the principal. Keep authoritative facts outside presentation. Inputs can
change the reporting window or explicit scenario assumptions; they cannot turn
missing joins into facts. A refresh reads sources; a scenario recalculates selected
assumptions. Make that distinction visible where it changes a decision.
