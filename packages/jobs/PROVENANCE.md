# Decision and upstream pins

Design source: HEL-1062, `start/.specs/agenticu-runtime/spec.md`, bounded decision `/tmp/agenticu-durable-job-design.md` (2026-11-26).

Donor Rat Stack revision `f396f76f8ced98d4bc4d510ae8457142cd66db81`: `packages/learn/src/progress-machine.ts`, `packages/deploy/src/machine.ts`; lock pins XState `6.0.0-beta.3`, `@xstate/effect` `1.0.0-beta.2`, Effect `4.1.4`. This implementation uses installed XState `6.0.0-beta.3` directly with current Effect `4.1.5`; no donor source was copied and `@xstate/effect` is not a dependency.

Inspected installed `xstate/dist/declarations/src/index.d.ts` and `transition.d.ts`: beta.3 exports `createMachine`, `initialTransition`, `transition`; `initialTransition` and `transition` return `[snapshot,effects]`. The host exercises those exact APIs in every state transition. It does not rely on later v6 actor persistence documentation or claim XState supplies SQLite durability. The application owns SQLite transactions and effect recovery.

Alchemy Domain donor pin `2.0.0-beta.87`, separately inspected installed `2.0.0-beta.85` (`Saga.ts`, `Model.ts`, `InMemory.ts`, `Platform.ts`) supplies workflow/platform contracts; the inspected in-memory layer does not survive exit and no ready Node SQLite workflow platform was established. Building that platform for one local wait was rejected in favor of this bounded host. Neither option creates exactly-once remote effects.
