# optional participation

Node 26 service for explicitly selected progress receipts. Public catalog and local progress have no dependency on this package or accounts. Shared storage is a separate SQLite file. It receives only the receipt keys explicitly selected by a caller; a selected receipt includes its complete original input or interpretation, when that receipt kind contains one. Choose intentionally.

```ts
import { openService, serve } from "@agentic-u/participation";
import { Effect } from "effect";
const baseURL = "http://127.0.0.1:4318";
const program = Effect.scoped(
  Effect.gen(function* host() {
    const service = yield* Effect.acquireRelease(
      openService({
        databasePath: "./participation.sqlite",
        baseURL,
        secret: process.env.PARTICIPATION_SECRET!,
      }),
      (service) => Effect.sync(() => service.close())
    );
    const server = yield* serve(service, {
      baseURL,
      port: 4318,
      hostname: "127.0.0.1",
    });
    // Acquisition returns after binding; server.address() is now available.
    // Scope release closes the listener before the database.
    yield* Effect.never;
  })
);
// Run program at the host entry point with its normal Effect runtime.
```

Keep a randomly generated secret of at least 32 characters stable across restarts. Back up and protect the database (it contains password hashes, sessions and selected receipts). Better Auth owns signup, password hashing, session cookies, expiration and revocation. This is a locally served shared account service; a production deployment and email recovery are not claimed. Network deployments must configure their actual HTTPS baseURL and origin. Startup errors use the typed ParticipationError channel with original causes. An occupied port reports transport failure; a database open failure reports storage failure. serve acquires its listener in the caller's Effect scope.

Use the exported Better Auth `createAuthClient({ baseURL, basePath: '/auth' })` for normal signup/signin and session revocation. Two devices sign into the same account independently; do not copy session cookies between devices. The supported Better Auth HTTP paths include `/auth/sign-up/email`, `/auth/sign-in/email`, `/auth/sign-out`, and `/auth/revoke-sessions`.

```ts
import { client } from "@agentic-u/participation";
import { Effect } from "effect";
const participation = client({ baseURL, fetch });
await Effect.runPromise(
  participation.syncSelected("./local-progress.sqlite", ["receipt-key"])
);
const sharedReceipts = await Effect.runPromise(participation.pull());
```

Browser fetch uses same-origin session cookies. Node callers supply a fetch implementation with their own cookie jar. Pull returns selected shared receipts; it does not silently modify local history or infer completion. Sync is append-only and idempotent per account/key. Conflicting content returns a typed conflict. There is no caller-selected account parameter: every read and write derives its principal from a fresh durable Better Auth session lookup. Cookie session caching is disabled so revoked sessions fail immediately. POST requires the service origin. Selections are capped at 100 receipts; the Node progress HTTP adapter caps bodies at 1 MiB. Selected subsets need not include related receipts; local record/resume continues to own complete local reference validation.

`pnpm --filter @agentic-u/participation build` and `test` exercise actual HTTP, independent cookie jars, durable restart, revocation and account isolation. Only fictional receipts and generated temporary test secrets are used.

Upstream: Better Auth 1.7.23, supported Node SQLite adapter and migrations. See [SQLite](https://better-auth.com/docs/adapters/sqlite), [database](https://better-auth.com/docs/concepts/database), and NOTICE for the Rat Stack adaptation and pinned MIT provenance.
