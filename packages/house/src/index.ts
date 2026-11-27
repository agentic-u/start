// @effect-diagnostics-next-line nodeBuiltinImport:off -- Host composition owns private storage locations.
import { mkdir } from "node:fs/promises";
// @effect-diagnostics-next-line nodeBuiltinImport:off
import path from "node:path";

import * as Bundles from "@agentic-u/bundles";
import { CatalogStore, CatalogError } from "@agentic-u/catalog";
import * as Local from "@agentic-u/local";
import { defineContract, implement } from "@agentic-u/operations";
import * as Progress from "@agentic-u/progress";
import { Context, Effect, Schema } from "effect";

export class House extends Context.Service<
  House,
  { readonly directory: string }
>()("@agentic-u/house/House") {}

export {
  Fit,
  Receipt,
  RequirementStanding,
  PlanOutput,
  GetOutput,
  CheckOutput,
  StatusOutput,
  Selection,
  Binding,
} from "@agentic-u/local";

export { BundleSelection, BundleReceipt } from "@agentic-u/bundles";

export { Command, History } from "@agentic-u/progress";

const Text = Schema.NonEmptyString;

const wayInput = Schema.Struct({ way: Text });

const localFailure = Schema.Union([Local.LocalError, CatalogError]);

const bundleFailure = Schema.Union([Bundles.BundleError, CatalogError]);

const localWrite = {
  readOnly: false,
  destructive: false,
  idempotent: true,
  openWorld: false,
};

const localAppend = { ...localWrite, idempotent: false };

const readOnly = { ...localWrite, readOnly: true };

export const plan = implement(
  defineContract("plan", {
    description:
      "Inspect selected local fit and binding evidence against the admitted public catalog. Initializes private storage when absent; grants no authority.",
    input: wayInput,
    output: Local.PlanOutput,
    failure: localFailure,
    annotations: localWrite,
  }),
  ({ way }) =>
    Effect.gen(function* planHouse() {
      const house = yield* House;
      const store = yield* CatalogStore;

      return yield* Local.plan(yield* store.load, way, house.directory);
    })
);

export const get = implement(
  defineContract("get", {
    description:
      "Select the current catalog generation locally. Repeated selection preserves the same fit; selection is not readiness or permission.",
    input: wayInput,
    output: Local.GetOutput,
    failure: localFailure,
    annotations: localWrite,
  }),
  ({ way }) =>
    Effect.gen(function* getHouse() {
      const house = yield* House;
      const store = yield* CatalogStore;

      return yield* Local.get(yield* store.load, way, house.directory);
    })
);

export const bind = implement(
  defineContract("bind", {
    description:
      "Select an exact local tool endpoint and account. Creates a new binding revision and invalidates prior checks, including on repetition.",
    input: Schema.Struct({ requirement: Text, selection: Local.Selection }),
    output: Local.Binding,
    failure: Local.LocalError,
    annotations: localAppend,
  }),
  ({ requirement, selection }) =>
    Effect.gen(function* bindHouse() {
      const house = yield* House;

      return yield* Local.bind(house.directory, requirement, selection);
    })
);

export const check = implement(
  defineContract("check", {
    description:
      "Run registered observations against actual bound tools and append dated receipts. Checks confer no outward authority.",
    input: wayInput,
    output: Local.CheckOutput,
    failure: localFailure,
    annotations: { ...localAppend, openWorld: true },
  }),
  ({ way }) =>
    Effect.gen(function* checkHouse() {
      const house = yield* House;
      const store = yield* CatalogStore;

      return yield* Local.check(yield* store.load, way, house.directory);
    })
);

export const status = implement(
  defineContract("status", {
    description:
      "Inspect current local fits and freshness. Initializes private storage when absent; does not infer principal approval.",
    input: Schema.Struct({}),
    output: Local.StatusOutput,
    failure: localFailure,
    annotations: localWrite,
  }),
  () =>
    Effect.gen(function* statusHouse() {
      const house = yield* House;
      const store = yield* CatalogStore;

      return yield* Local.status(yield* store.load, house.directory);
    })
);

export const acquireBundle = implement(
  defineContract("acquireBundle", {
    description:
      "Acquire complete versioned public instructions and recursive dependencies into the private house, reporting changed requirements and affected checks.",
    input: Schema.Struct({
      id: Text,
      expectedGeneration: Schema.optionalKey(Text),
    }),
    output: Bundles.BundleReceipt,
    failure: bundleFailure,
    annotations: localWrite,
  }),
  (input) =>
    Effect.gen(function* acquireHouseBundle() {
      const house = yield* House;
      const store = yield* CatalogStore;

      return yield* Bundles.acquireBundle({
        ...input,
        catalog: yield* store.load,
        directory: path.join(house.directory, ".agenticu", "bundles"),
      });
    })
);

export const readBundle = implement(
  defineContract("readBundle", {
    description:
      "Read a previously acquired complete bundle with its content digest verified. Does not modify house state.",
    input: Schema.Struct({ id: Text }),
    output: Bundles.BundleSelection,
    failure: Bundles.BundleError,
    annotations: readOnly,
  }),
  ({ id }) =>
    Effect.gen(function* readHouseBundle() {
      const house = yield* House;

      return yield* Bundles.readSelectedBundle({
        id,
        directory: path.join(house.directory, ".agenticu", "bundles"),
      });
    })
);

const [viewed, started, artifact, checked, principalCommand] =
  Progress.Command.members;

const agentCommand = Schema.Union([viewed, started, artifact, checked]);

const progressPath = Effect.gen(function* prepareProgress() {
  const house = yield* House;
  const directory = path.join(house.directory, ".agenticu");
  yield* Effect.tryPromise({
    try: () => mkdir(directory, { recursive: true, mode: 0o700 }),
    catch: (cause) =>
      new Progress.ProgressError({
        reason: "storage",
        message: "Could not initialize private progress storage.",
        cause,
      }),
  });

  return path.join(directory, "progress.sqlite");
});

export const record = implement(
  defineContract("record", {
    description:
      "Record a view, attempt, artifact or reported check. An exact repeated key is idempotent; changed content conflicts. This cannot record principal acceptance.",
    input: Schema.Struct({ command: agentCommand }),
    output: Progress.History,
    failure: Progress.ProgressError,
    annotations: localWrite,
  }),
  ({ command }) =>
    Effect.gen(function* recordHouseProgress() {
      return yield* Progress.record(yield* progressPath, command);
    })
);

export const accept = implement(
  defineContract("accept", {
    description:
      "Record the principal's explicit acceptance or rejection of a referenced check. Requires the host's principal approval service; an agent-supplied principal label is not authorization.",
    input: Schema.Struct({ command: principalCommand }),
    output: Progress.History,
    failure: Progress.ProgressError,
    annotations: localWrite,
    needsApproval: true,
  }),
  ({ command }) =>
    Effect.gen(function* acceptHouseProgress() {
      return yield* Progress.record(yield* progressPath, command);
    })
);

export const resume = implement(
  defineContract("resume", {
    description:
      "Read ordered local progress receipts for a fresh agent, preserving views, artifacts, reported checks and principal decisions separately. Initializes storage when absent.",
    input: Schema.Struct({}),
    output: Progress.History,
    failure: Progress.ProgressError,
    annotations: localWrite,
  }),
  () =>
    Effect.gen(function* resumeHouseProgress() {
      return yield* Progress.resume(yield* progressPath);
    })
);

export const houseOperations = [
  plan,
  get,
  bind,
  check,
  status,
  acquireBundle,
  readBundle,
  record,
  accept,
  resume,
] as const;
