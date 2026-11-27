# Find and connect the owner's actual sources

Start from the owner's services, files and permissions. A founder may have a
Shopify or WooCommerce store, Stripe/Shopify Payments/PayPal, marketplace accounts,
ad platforms, GA4 or another tracker, a 3PL/carrier portal and cost spreadsheets.
Discover the actual combination. A warehouse is useful when it removes work; it
is not a prerequisite for answering the supported parts of the question.

Use existing skills, connectors, native CLIs, official documentation and ordinary
provider interfaces. Search current documentation when a route is unfamiliar.
Do not turn missing institutional instructions into a request that the founder
learn the API. Do not build another ingestion service before checking the native
connector. A source-specific export can still be the best available evidence.

## PostHog and managed Meta imports

When the owner wants this setup, find their existing PostHog account, region,
organization and project. Preserve unrelated projects. Check current plan and
source allowances in the actual tenant; a limit is not permission to upgrade
billing or repurpose someone else's project. Fit an authorized separate project
or organization if appropriate. New-account email/identity confirmation remains
the owner's secure action when required. Never copy another owner's login.

Read the current [Meta source instructions](https://posthog.com/docs/data-pipelines/sources/meta-ads)
and available native setup interfaces. PostHog's managed Meta connection lets an
authorized Meta principal connect and choose an ad account. It is distinct from
the Meta Ads MCP OAuth grant; configuring MCP alone does not create warehouse
imports. Do not require the founder to register a developer app or paste access
tokens when the managed connector fits. Current setup may expose a browser,
wizard, MCP or API route; use the one actually available and authorized.

Verify the intended Meta principal, business assets and granted data access.
Let the owner complete genuine provider consent when it requires them. Never
report an authorization URL or successful redirect as usable account access.
Read back the actual integration and account identity/status/currency/timezone.
Agency access can expose unrelated businesses; access is not scope to import them.

Configure an account-specific source and unique stable table prefix for each
selected account. Set the historical range needed for the question. Inspect the
actual attribution-window configuration; ad-platform conversion attribution is
not merchant receipt lineage. One successful connection is not proof that every
requested account is available. Reuse an existing correctly fitted source rather
than creating duplicate sources on every retry.

Wait for actual source/schema status, then inspect real table names, columns,
rows and native dates. Entity tables and statistics can refresh on different
clocks. A completed sync can still contain old data or omit the required ad.
Increasing a historical-lookback setting may require an explicit resync of
already imported tables. Reconcile spend/impressions/clicks for an equivalent
account/date/cutoff against the native reference. Preserve missing metrics and
partial history. Use only the affected refresh/resync when needed.

Execute the actual report query freshly. Read its cache/refresh metadata and the
source's data-through separately. A saved query definition, cached result and new
sync status are three different observations. Do not schedule recurring refresh
until the intended extraction → import → query → report path works once.

## New measurement is not historical recovery

Fit the actual website/app SDK or capture route, correct project key/region,
consent, privacy and event design. Administrative secrets do not belong in the
browser; a public capture key does not grant query or configuration rights.
Instrument the smallest useful journey, make an explicitly marked QA visit,
and read its exact occurrence back in the intended destination. Consent declined
must not become an unmarked measurement visit. Keep QA out of business totals.
Do not call a generated test event a real customer or replay historical purchases
to make a new project look populated.

Existing GA4/other tracker history remains a separately dated source. New
instrumentation can preserve future checkout/order/ad carriers, but it cannot
retroactively establish a historical join that was never recorded.

## Source meanings that must survive fitting

| Source family | What to establish |
| --- | --- |
| Shopify / WooCommerce / other store | Paid versus authorized/unpaid/cancelled/test; discounts; merchandise versus shipping/tax; native order/transaction/refund identities; pagination/history scope; actual custom tracking fields. Store and gateway records frequently describe the same money. |
| Stripe / Shopify Payments / PayPal | Native capture/payment relation; smallest-unit versus decimal amount representation; fees and refunds; disputes; currency; sale versus payout/available dates. A payout is not another sale, and an authorization is not a capture. |
| GA4 / PostHog / tracker / Klaviyo | Actual event/property schema, consent and retention, duplicate occurrence/transaction behavior, exact order/carrier relations and clocks. An email-platform order event is not independent merchant revenue. |
| Meta / Google Ads | Account/parent identities, timezones/currencies, numeric strings or spend micros, equivalent cutoffs, provider attribution windows. Fractional/platform conversion credit does not define merchant transaction counts. |
| Carrier / 3PL / returns / supplier | Order/line/shipment identities; consolidated parcels; label/fulfillment/return charges; credits; actual allocated costs versus dated rates; inventory/paid/fulfilled units. Cost one shared parcel once. |
| Amazon / other marketplace | Gross sales, finance fees/proceeds, settlement reserves and returns, product cost and ad attribution grain. Marketplace orders, settlements and ad-attributed sales overlap; aggregate ad reports may not support an exact per-order/per-ad join. |

If necessary evidence is missing, keep the supported table and uncertainty
visible. Ask for the smallest business-owned fact or access that changes the
answer. Record reusable acquisition/fitting knowledge with the method; do not
give the recipient or founder a second reporting job to prove that they worked.

Inspect precise native flags, not their everyday names. For example, Stripe
`paid: true` can include an authorization awaiting capture; establish capture
separately. Its `refunded` boolean means fully refunded, while `amount_refunded`
can describe a partial refund with that boolean still false. Use the related
refund/balance records to establish the amounts and fee effects. Similarly,
Shopify's default order-history access can be shorter than a requested ad
lookback. Broader ad history does not repair missing merchant history.

The operating lineage and the qualification boundaries are in [SOURCES.md](SOURCES.md)
and the repository's EVIDENCE.md. Vendor-shaped mocks exercise discovery and
reasoning; they do not qualify real OAuth, billing, production sync or every
provider adapter.
