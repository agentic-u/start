# House operations

Typed operations compose existing catalog, local bindings/checks, bundles and progress owners. The host provides `House` with a private directory and `CatalogStore` with its admitted public catalog. Invocation input cannot change the house directory. CLI root selection belongs to host composition.

```ts
import { CatalogStore } from "@agentic-u/catalog";
import { House, get } from "@agentic-u/house";
import { Effect } from "effect";

const fit = get
  .handler({ way: "runtime:git" })
  .pipe(
    Effect.provideService(House, { directory: "/tmp/fictional-house" }),
    Effect.provideService(CatalogStore, { load: admittedCatalogEffect })
  );
```

`houseOperations` feeds the adopted `toCommand`, `toToolkit`, and `toHttpApi` projections directly. Shared schemas are re-exported from their owners. `record` admits views, starts, artifacts and reported checks; `accept` alone admits principal decisions and requires host approval. Configure `Approval.denyAll` for unattended hosts. A caller's principal label never grants authority.

Metadata describes actual implementation: SQLite readers may initialize private state; bind creates a fresh revision on repetition; check appends fresh real observations. Neither is marked idempotent. Exact progress replay and fit selection are idempotent. Bundle acquisition writes local content-addressed packages and reports instruction changes and affected checks.
