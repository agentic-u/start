---
name: compose-customer-journey
description: Model, validate and exercise a business-specific branching customer journey including qualification, checkout, upsell and delivery, with bounded retries and resumable history.
compatibility: A file-capable agent and the pinned journey implementation. This capability models routing; it does not deploy pages, verify payments or send messages.
metadata:
  revision: "draft-1"
---

# Compose the customer journey

Acquire `spellbook` through ../../IMPLEMENTATIONS.md. Read the included
`packages/funnel/src/Journey/README.md`, schema and examples. Use the `journey`
entry returned by acquisition; its input is a JSON file with Validate, Simulate
or Resume. Write inputs with the agent's file editor, not shell payloads.

Read the owner's offer, audience, terms, delivery and current customer path first.
Define meaningful steps, observations, explicit conditional routes, terminal
outcomes and bounded re-entry. Ask for real commercial choices; do not import a
fixture's business policy. Validate the graph, exercise useful paths and meaningful
failure/recovery paths, then resume from the produced archive in a fresh process.

Keep the business meaning of each observation explicit. A caller-supplied `paid`
event is routing input, not payment evidence. Use the owning payment, booking or
delivery adapter to establish that fact when connecting an operating system. Leave
the graph, source decisions, exercised traces and unresolved integrations in the
owner's workspace. Use launch-measured-funnel when the requested outcome includes
actual deployment and operation; do not present a simulation as that completion.
