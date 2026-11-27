---
name: report-ad-profitability
description: Explain what ads actually contribute using native spend, merchant receipts, exact attribution, product and parcel economics, source coverage and explicit estimates. Build the founder's tables and scenarios; identify when missing joins make per-ad conclusions unavailable.
compatibility: A file-capable agent with authorized access to the owner's actual advertising, analytics, commerce and cost sources, or original exports. No fixed vendor, AU runtime, warehouse or general onboarding is required.
metadata:
  revision: "draft-1"
---

# Find what the ads actually contribute

Start with the owner's question and existing work. Read [the reporting method](METHOD.md)
and its [source lineage](SOURCES.md). The method comes from an operating multi-account
commerce report, not a prejoined two-table demonstration. Adapt to the business's
actual sources and presentation. Do useful work while investigating gaps; do not
make the founder fill a technical checklist or maintain a reporting ledger.

[Existing implementations](IMPLEMENTATION.md) are available where their actual
contract fits. They are building blocks, not proof that a new merchant's joins exist.

Recover the economic boundary, dates and intended decision: merchant, affiliate or
integrated business; sale-period or acquisition cohort; historical observed result
or forward scenario. Inspect existing account access, original exports and actual
tracking carriers. Use the owner's existing tools and authorized CLIs/MCPs. A
connection name is not proof of the right account or fresh complete data.

Read source schemas and records, trace the joins and reconcile native money/spend
before attributing contribution. The report must distinguish verified attribution,
unassigned records, conflicting evidence and source coverage that cannot yet be
assessed. An exact string match proves only the relation its source actually owns.

Produce the tables the founder needs: account/campaign/adset/ad, daily comparisons,
frontend versus paid upsell value, funnel cost/counts, modeled contribution and
break-even/allowable-CPA scenarios when inputs support them. Keep useful measured
parts visible when another component is unavailable. A missing join is not an
instruction to allocate revenue proportionally or silently replace it with zero.

Use [work-with-reporting-canvas](../work-with-reporting-canvas/SKILL.md) when tldraw
would help the principal inspect, ask questions, change assumptions or direct the
work. The canvas displays checked report data and explicitly labeled scenarios;
it is not the authority for merchant facts, joins or credentials. Other requested
tables/files/interfaces remain valid outcomes. Deliver useful outputs and a clear
way to return to them, not an audit packet as the person's homework.
