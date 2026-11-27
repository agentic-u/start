# Compiler fence source

Adapted from Joel Hooks' Rat Stack, MIT licensed, commit `f396f76f8ced98d4bc4d510ae8457142cd66db81`:

- `packages/core/test/typecheck-parity.parity.ts`: real compiler execution, diagnostic normalization, planted TypeScript failure and valid neighbor, workspace error/verdict parity.
- Root `package.json`: `effect-tsgo patch` preparation, strict `effect-tsrs diagnostics --strict --type-check`, patched `tsc`, and plain `tsrs` comparison.

Target changes: Node's test runner avoids coupling compiler seam tests to an Effect test runtime; paths discover `@agentic-u` runtime workspaces; a floating Effect fixture proves the configured Effect diagnostic is active. Plain tsrs compares only ordinary TypeScript diagnostics because it has no Effect diagnostic engine. Both strict engines must reject the floating Effect and accept its adjacent exported-value version. Compiler startup failures never count as successful parity.

Exact checker pins: TypeScript 7.0.2, @effect/tsgo 0.69.0, @yielded/effect-tsrs 0.2.3, tsrs 0.25.0-ts7.1.0-beta. Preparation must run after installation; a language-service plugin entry alone does not activate compiler checking.

The test does not exempt product directories or override diagnostic severity. Product failures can agree across checkers and therefore satisfy parity; the independent workspace typecheck gate still must pass.
