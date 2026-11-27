# Public catalog reader

Consumes the generated agenticu-catalog/1 export authored by House of Houses. Catalog data is not separately authored here. The generation is a content-integrity hash, not a signature or an authenticity claim. Public workflow admission also requires the public sight marker; private principal records do not belong in this export.

Invocable contracts and projections use the attributed Rat Stack implementation in @agentic-u/operations. Read-only queries do not establish local tool readiness, execution authority or method success.

The domain modules adopt the existing House of Houses kernel/workflow.ts, kernel/laws.ts and surface/library.ts, ready.ts and calls.ts at 3303110cc8d3743bf9d9c86c0d65e3b4df71aca3. The filesystem reader is replaced by checked catalog admission; the pure workflow, conditional requirements and claimed-readiness behavior remains owned here. The site imports this package's domain exports instead of keeping a second implementation.

test/fixtures/catalog.json is generated public source data, not a separately authored sample. test/fixtures/native-calls.json records 188 outputs from the original native public handlers at the commit above, including every workflow's whole read, every step read, requirements, empty-ID readiness and all-ID readiness. Regenerate with test/generate-native-golden.mjs against the original owning checkout before its old domain files are removed. The tests compare those external source outputs with this operation registry. Neither fixture is included in the installed package.
