# Rat Stack operation package adoption

Source: https://github.com/joelhooks/rat-stack/tree/f396f76f8ced98d4bc4d510ae8457142cd66db81/packages/capability

The source, tests and sandbox-lifetime script are adopted from this exact MIT-licensed revision. The package is named `@agentic-u/operations`; internal donor service keys and `Capability` types remain unchanged. LICENSE retains Joel Hooks' notice.

Adaptations: Effect, platform-node and effect/vitest move together from 4.1.4 to 4.1.5 to match AgenticU. The two package self-imports in the RPC-group test use the new package name. The standalone package check uses TypeScript; adopting Rat Stack's full strict Effect diagnostics and lint fence remains HEL-1052 and is not claimed by this package check. All runtime projections and their tests are retained. Packing builds dist and includes its source and license. No website dependency is required.

One runtime adaptation fixes Node 26 scheduling: rejected dynamic-import awaits remain pending in the isolated vm context until another evaluation drains its microtask queue. Two unchanged donor sandbox refusal tests timed out on Node 26.4.0 and 26.13.1, but passed unchanged on donor Node 24.18.0. The adapted runner drains that same isolated queue every 10ms during an active run, bounded by the existing evaluation deadline and error channel. The parent reviewed the source delta and independently reran all 146 copied tests on Node 26.13.1 successfully. No import permission, test timeout or assertion was weakened. The only source-file delta against the donor is this scheduler correction; only the RPC-group test package self-imports differ in the copied test tree.
