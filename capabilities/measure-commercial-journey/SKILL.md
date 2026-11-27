---
name: measure-commercial-journey
description: Fit and prove tracking for a commercial journey across pages, campaigns, booking or checkout, fulfilment and business outcomes. Use when asked to instrument a funnel, reconcile attribution, or diagnose commercial measurement.
compatibility: A file-capable agent using existing authorised browser, HTTP, deployment and provider interfaces. No AgenticU CLI or particular analytics vendor is required.
metadata:
  revision: "draft-1"
---

# Measure the actual commercial journey

Experimental method adapted from operational performance-commerce work. A source method and a connected account are not proof that this implementation works. Enter through BOOTSTRAP.md and fit the actual job, owner authority and available tools. Preserve existing systems and source ownership.

## State what counts

Read the selected offer, actual visitor journey, transaction or booking records, delivery and commercial aim. Define the event/value law before adding scripts: what occurrence counts; event name; product or service; value/currency; exclusions; refunds/cancellations; identity carriers; record owner; destinations; and what would prove each edge. Booking, order, platform Purchase projection, payout and fulfilment are different facts. Do not choose Purchase as a default for unknown events.

Keep business occurrences distinct from their projections. One occurrence needs one stable identity across the relevant destinations. Where a provider deduplicates browser/server events, both projections use the same event identity. Order identity usually owns order deduplication; a checkout or session identity is a different thing. Inspect the actual provider contract rather than importing another business's tokens or product rules.

## Fit the means here

Use the private capability lock or adequate current equivalent. For each selected surface record the exact owner/account/workspace, required reads/writes, event and identity inputs/outputs, available implementation, authority, observed state, proof and unresolved dependency. Do not copy another principal's credentials or infer authority from an adjacent login or logo. Bind existing suitable tools; build a missing adapter only when this journey needs it. Do not install the current AU runtime.

Map the real path, for example:

`campaign identity → click/visit → landing action → exact booking/checkout → native occurrence → one canonical event → destination projections → delivery and financial readout`

Use only relevant stages; a lead-generation service does not need a fictional checkout. Carry identity through native supported navigation/fields. Keep tracking identity separate from private buyer identity, minimize personal data, and preserve consent choices. Analytics failure must not block the intended customer action. Do not wait for vendors or invent a caller-controlled redirect to make a tracking test pass.

## Implement and prove edges

Start with configuration readback, actual navigation, resource requests and clearly marked non-commercial tests. Show that the CTA reaches the intended destination and that required identity survives. Then exercise the authorised test booking/transaction or comparable occurrence if available. Preserve the source occurrence, identity/value, canonical event, dedup behavior and destination readback. A saved setting, collector response, dashboard row or provider success toast proves only that boundary.

Test relevant duplicate/replay behavior and an excluded or cancelled/refunded occurrence, without manufacturing real commerce. A reloaded thank-you page must not create another sale. Missing identity or an unknown event must remain visible, not silently become an attributed purchase. Browser/server projections must not double count one occurrence. Preserve the original records before any correction.

Report evidence and clocks for each source. Reconcile spend, qualified leads/bookings/orders, merchant money and fulfilment at their native grains. Do not join records only because amounts or timestamps look close. A warehouse projection is not a new order ledger. An invoice is not payment; expected value is not observed money.

## Interpret and continue

Separate instrumentation faults, missing source data, attribution and the business hypothesis. A click-to-order join establishes traceability; incremental causal lift needs an appropriate counterfactual/experiment design. Do not convert an editorial belief or attribution report into a measured advertising winner.

Leave the current event/identity/value law, selected bindings, actual tested journey, receipts, known failures, unresolved edges and next responsible action. Keep real/test traffic and events distinguishable. Release of public traffic, external messages, purchases or spend uses the actual authority for the selected business; successful wiring does not grant it. Continue authorised independent work while an owner-only grant waits.
