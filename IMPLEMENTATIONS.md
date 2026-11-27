# Use the implementations

The person describes the outcome. Their agent selects a method from CAPABILITIES.md,
then acquires an implementation when it fits the work. These are existing Spellbook
implementations, distributed independently of its private development checkout.
The AgenticU runtime and general onboarding are not prerequisites.

`implementations.json` owns the release URL and archive SHA-256. Acquire into the
person's existing private workspace:

```
python3 tools/implementations.py spellbook --workspace /absolute/business-folder
```

The JSON receipt gives the installed directory, Node executable and entry paths.
Run entries with that Node and follow their method below. The installer reuses the
existing Node acquisition implementation; it does not install or invoke `au`.
It verifies the archive and all manifest source files before `npm ci --ignore-scripts`.
It changes no global configuration, copies no credentials and performs no provider
operation. Network access and the host's HTTPS-capable curl are required to acquire
the release and dependencies. macOS already supplies curl.
An already downloaded archive can be supplied with `--archive`; the same pinned
hash still applies. Private fitting, original sources, outputs and operating state
stay in the business workspace. Preserve the installation's `.env` and `.alchemy`
state privately when provider operations use them.

| Outcome | Agent method | Implementation |
| --- | --- | --- |
| Report source-qualified ad economics with explicit missing joins and costs | [Ad profitability](capabilities/report-ad-profitability/SKILL.md) | Source-specific agent fitting; optional installed Numbers Window primitives, not a universal native collector |
| Compose reporting tables and scenario inputs in a shared canvas | [Reporting canvas](capabilities/work-with-reporting-canvas/SKILL.md) | Official tldraw office app + its live API; separate licensed installation |
| Exercise an offer → checkout → inbox → report/refund locally | [Business composition](capabilities/launch-measured-funnel/implementation.md) | `spell`; new-owner hosted deployment has an unresolved isolation gap |
| Compile and exercise a funnel with persisted intake and first-party tracking | [Funnel runtime](capabilities/launch-measured-funnel/implementation.md#funnel-runtime) | `funnel` |
| Make a recorded session searchable and cuttable | [Work with recordings](capabilities/work-with-recordings/SKILL.md) | `tape` |
| Validate, simulate and resume a branching customer journey | [Compose a customer journey](capabilities/compose-customer-journey/SKILL.md) | `journey` |

Source presence, successful installation, local exercise and real provider exercise
are separate facts. Read EVIDENCE.md for the source revision actually qualified.
The hosted welcome inbox is a durable sandbox inbox, not an email delivery claim.
The funnel runtime's queued email and unavailable checkout are not substitutes for
the hosted commerce implementation. Select the path that fits the actual outcome.
