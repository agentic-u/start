# Engineering fence adoption

This is AgenticU's adoption of the substantive Rat Stack Oxlint fence, not a new lint framework. Donor: [joelhooks/rat-stack at f396f76f8ced98d4bc4d510ae8457142cd66db81](https://github.com/joelhooks/rat-stack/tree/f396f76f8ced98d4bc4d510ae8457142cd66db81). `LICENSE` retains the donor's MIT license. The anti-slop and Landmines trees retain their own `LICENSE` and `UPSTREAM.md`; the nested eslint-stylistic vendor attribution is retained too.

## Adopted mechanisms

| Family | Source and disposition |
| --- | --- |
| Generic anti-slop | `tools/oxlint/anti-slop` copied with all 19 exported rules, helpers, vendored spacing implementation and upstream RuleTester tests. |
| Effect anti-slop | All nine Effect rules copied: tagged construction/types/comparison/error handling, service imports, match, operation spans and cause preservation. Upstream negative and valid RuleTester cases retained. |
| Architecture | Actual `scripts/oxlint-plugin-boundaries.ts`, adapted as `plugins/boundaries.ts`. All eight rules retained: browser globals, browser/server imports, build-only snippets/OG engines, domain adapters, cross-layer imports, production devtools, feature transport, contract-derived surfaces. |
| Patterns | Actual `scripts/oxlint-plugin-patterns.ts`, adapted as `plugins/patterns.ts`. All 12 rules retained, including resource acquisition, contract names, mutable module state, shared pending effects and waiters, sleeping loops, hex encoding, staged retention, actor observation, flag deadlines and authored examples. |
| Test runtime | Actual `scripts/oxlint-plugin-effect-tests.ts`: tests must use the scoped Effect test runtime. |
| Comments | Actual donor no-comments plugin retained, including reasoned directives and safety comments. Its source is excluded from self-lint, as the donor excluded its vendored rule sources. |
| Test Landmines | Actual five exported donor warning rules and RuleTester cases copied. The donor's unrelated existing-debt budget is replaced with an empty budget. This package does not claim a warning budget gate until its baseline checker is wired into the root checks. |
| Base lint | Actual donor Ultracite core extension and applicable donor rule configuration retained in root `oxlint.config.ts`. |

## Deliberate adaptations

- `packages/capability` and `@rat-stack/capability` become `packages/operations` and `@agentic-u/operations`. Both path and import-identity recognition are changed; changing diagnostic prose alone would leave the architecture checks inert.
- The workspace boundary resolver recognizes only the owned `@agentic-u` namespace. Owned package imports resolve logically even before an optional package exists; third-party scopes are not mistaken for workspace dependencies. The two donor renamed-scope negative cases become third-party valid neighbors, while the owned-scope negative cases remain. Infra has a reserved app owner; other app resolution checks the actual app directory. Relative imports are normalized by the donor resolver.
- `packages/core` remains the future domain-only boundary. The operations package contains legitimate HTTP/RPC adapters, so treating it as domain core would reject its job. Generic package-to-app boundaries apply to operations now.
- Browser-safe operations entry points are the existing `rpc-group` and `web-mcp` projections. Other operations implementations remain server-side. Projection construction is allowed in the owning operations package and rejected in callers.
- Plugin repository roots now resolve from `packages/fence/plugins`. Diagnostic ids use `agentic-u-boundaries` / `agentic-u-patterns`; generic upstream ids stay stable.
- Content-regex policy starts empty. Rat Stack's specific content exceptions are not AgenticU evidence. The AST rule remains available and scoped to the same named content compiler paths when those exist.
- The donor's repository-wide learn-card corpus acceptance test is omitted because those Rat Stack content files are not part of this package. The positive and negative learn-snippet lint fixtures remain.

## Engines and dormant named cases

These are explicit activation cases, not replacements with weaker homegrown checks:

- Foldkit's recommended plugin activates when a Foldkit runtime is adopted. AgenticU's current site uses Astro and Effect UI; enabling Foldkit's runtime-specific rules globally would assert the wrong framework. Preserve its upstream recommended configuration at that point.
- `@xstate/effect/oxlint` / `no-inline-effect` activates when the XState engine is installed. The donor's independent `watch-effect-actors` rule is present now and tested against `@agentic-u/operations/actor-watch`.
- Alchemy stage-retention rules are present and tested without requiring Alchemy at runtime; they activate on actual Alchemy imports. No donor deployment state or resources are copied.
- Donor event-cartridge/Basin seams, core/adapters, auth/devtools, code-snippets/OG and content compiler restrictions remain named in the plugin with the AgenticU namespace. They become relevant when those owners exist. Their negative fixtures prove they are real enforcement, not documentary promises.
- Donor product content, learn cards, Rat-specific auth policies, catalog layout exceptions, and existing lint-debt allowances are not imported as AgenticU product data.

## Verification and remaining qualification

Run `pnpm --filter @agentic-u/fence test` after a frozen workspace install. It runs the copied upstream RuleTester negatives/valid neighbors, adapted architecture/pattern process suites, and integration fixtures placed at actual AgenticU package paths. The integration tests spawn the real Oxlint executable. `OXLINT_BIN` can select an explicitly reported temporary runner; it is not a shipped fallback.

The full engineering fence additionally requires the root owners to wire and prove the patched Effect compiler/parity, frozen cold install, env admission, hook/VCS policy, Landmines budget accounting, Turbo input/cache honesty, CI and packed runtime consumer test. This package alone does not qualify any of those. A green plugin suite proves the lint rules reject their defects; it does not prove the whole application or a user's environment passed onboarding.
