# Local fitting

Ordinary caller usage (Effects run at the transport boundary):

```ts
await Effect.runPromise(get(catalog, "runtime:git", house));
await Effect.runPromise(
  bind(house, "runtime:git", {
    adapter: "git",
    endpoint: { kind: "git", repository: house },
    account: null,
  })
);
await Effect.runPromise(check(catalog, "runtime:git", house));
const standing = await Effect.runPromise(status(catalog, house));
```

`runtime:git` is a runtime-owned read-only tool check, not a requirement invented for every catalog workflow. Public Need prose remains unresolved until runtime code defines a matching check contract. Bindings select tools; checks observe them; neither grants permission. No operation here sends or publishes anything. Browser control is deliberately unsupported until a supported host Browse interface is connected; binding a label cannot pass it.

One private `.agenticu/capability.sqlite` holds selected releases, bindings, immutable check receipts and scoped grants. Its mode is 0600 and the owner directory is 0700. No credentials are stored. SQLite transactions prevent concurrent lost updates and release their writer lock when the process exits.

Git repository paths are relative to the selected house, never to a later caller's working directory. Binding resolves them once to an absolute path and follows existing symlinks with `realpath`. A missing path retains its absolute house-relative location so an unresolved repository can be bound before it exists. Checks use that persisted path; persisted relative Git paths are rejected at state admission.
