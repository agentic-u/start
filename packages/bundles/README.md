# Scoped instruction acquisition

```ts
const acquired =
  yield *
  acquireBundle({
    catalog,
    id: "workflow:prepare",
    directory: ".agenticu",
    expectedGeneration: catalog.generation,
  });
const selected =
  yield *
  readSelectedBundle({ directory: ".agenticu", id: "workflow:prepare" });
```

The directory is an acquisition store, separate from private bindings, facts and checks. Packages retain exact document text, selected workflow bodies, recursive requirements and catalog generation. Updating selects a new immutable package, preserves previous packages and reports changed requirement IDs and affected check IDs. Acquisition grants no authority and verifies no local binding. IDs are hashed before filesystem use. Reference files are atomically replaced only after package installation.

Workflow IDs accept either `prepare` or `workflow:prepare` for both acquisition and reading. Both select the same canonical `workflow:prepare` package and digest. Other document kinds retain their qualified catalog ID.
