# Local learning receipts

```ts
import { admitCommand, record, resume } from "@agentic-u/progress";
import { Effect } from "effect";

// The caller admits tool/CLI input once. The parent directory already exists.
const command =
  yield *
  admitCommand({
    kind: "started",
    key: "start-001",
    attempt: "review-001",
    way: "workflow:review",
    version: "v1",
    at: "2026-11-26T12:00:00Z",
    originalInput: { ownerWords: "review our fictional launch draft" },
  });
yield * record(".agenticu/progress.sqlite", command);
const receipts = yield * resume(".agenticu/progress.sqlite");
```

Run the example inside `Effect.gen`. Record `viewed`, then `started`, `artifact`, `checked`, and a separate `accepted` principal decision as applicable. Each receipt has a caller-owned idempotency key and dated way/version. Artifact receipts retain interpretation separately from the start's original owner input. Checks reference artifact receipt keys; principal decisions reference check receipt keys. Multiple artifacts/checks/decisions remain visible in order; failed checks and rejected decisions are retained. Nothing infers competence, acceptance, current authority, or independent verification. The caller is responsible for obtaining actual principal authority before recording their decision; this local store provides no authentication.

SQLite's immediate transactions serialize writers, its rollback journal recovers interrupted writes, and FULL synchronous commits provide the durability boundary. Repeating the same key/content returns saved history; changing content conflicts. Malformed existing data fails and is preserved. A busy/unavailable/corrupt file yields a typed `ProgressError` with original cause. Callers may inspect that cause; there is no silent retry or empty-state fallback. Node 26.13.1 provides SQLite; no service or cloud account is required.

Source reconciliation: `tools/workspace.py` owns bootstrap owner answers/checkpoints, using a locked journal and atomic derived files. These learning receipts have a separate owner and use SQLite transactions rather than copying a second journal/locking implementation. `agenticUdotsurf/packages/learn/src/progress.ts` was inspected: its familiarity/decay reducer conflates a different learning domain and was not copied. No donor code was copied in this package.

Proof: `pnpm --filter @agentic-u/progress build` then `pnpm --filter @agentic-u/progress test`; tests use real temporary files, fresh processes, concurrent processes, killed uncommitted writers and corrupt bytes. Synthetic fictional receipts prove storage behavior, not learner competence or principal acceptance.
