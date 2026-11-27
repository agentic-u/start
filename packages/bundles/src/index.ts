import { Document, Supply, Workflow } from "@agentic-u/catalog";
import type { Catalog } from "@agentic-u/catalog";
import { Effect, Predicate, Schema } from "effect";

import {
  digest,
  installPackage,
  readPackage,
  readSelection,
} from "./node-store.js";

const Text = Schema.NonEmptyString;

export const BundleSelection = Schema.Struct({
  format: Schema.Literal("agenticu-bundle/1"),
  generation: Text,
  id: Text,
  workflows: Schema.Array(Workflow),
  requirements: Schema.Array(Schema.Struct({ id: Text, body: Supply })),
  documents: Schema.Array(Document),
});

export type Bundle = typeof BundleSelection.Type;

export const BundleReceipt = Schema.Struct({
  bundle: BundleSelection,
  digest: Text,
  changedRequirements: Schema.Array(Text),
  affectedChecks: Schema.Array(Text),
});

export type AcquiredBundle = typeof BundleReceipt.Type;

const Reference = Schema.Struct({
  digest: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/u)),
});

export class BundleError extends Schema.TaggedError<BundleError>()(
  "BundleError",
  {
    reason: Schema.Literals([
      "not-found",
      "generation-mismatch",
      "invalid",
      "storage",
    ]),
    message: Schema.String,
    next: Schema.String,
    cause: Schema.optionalKey(Schema.Unknown),
  }
) {}

const storage = <A>(action: () => Promise<A>): Effect.Effect<A, BundleError> =>
  Effect.tryPromise({
    try: action,
    catch: (cause) =>
      new BundleError({
        reason: "storage",
        message: "Bundle store operation failed.",
        next: "Check the acquisition directory permissions and retry.",
        cause,
      }),
  });

export const readSelectedBundle = ({
  directory,
  id,
}: {
  readonly directory: string;
  readonly id: string;
}): Effect.Effect<Bundle, BundleError> =>
  Effect.gen(function* readSelected() {
    const referenceText = yield* Effect.tryPromise({
      try: () => readSelection(directory, id),
      catch: (cause) =>
        new BundleError({
          reason:
            Predicate.hasProperty(cause, "code") && cause.code === "ENOENT"
              ? "not-found"
              : "storage",
          message: "Selected bundle could not be read.",
          next: "Acquire the selected way into this directory.",
          cause,
        }),
    });

    const reference = yield* Schema.decodeUnknownEffect(
      Schema.fromJsonString(Reference)
    )(referenceText).pipe(
      Effect.mapError(
        (cause) =>
          new BundleError({
            reason: "invalid",
            message: "Invalid bundle selection reference.",
            next: "Inspect the acquisition store; do not repair private state automatically.",
            cause,
          })
      )
    );

    const bytes = yield* storage(() =>
      readPackage(directory, reference.digest)
    );

    if (digest(bytes) !== reference.digest) {
      return yield* new BundleError({
        reason: "invalid",
        message: "Bundle content digest disagrees with selection.",
        next: "Acquire a complete verified package again.",
      });
    }

    const bundle = yield* Schema.decodeUnknownEffect(
      Schema.fromJsonString(BundleSelection)
    )(bytes).pipe(
      Effect.mapError(
        (cause) =>
          new BundleError({
            reason: "invalid",
            message: "Invalid stored bundle.",
            next: "Inspect the acquisition store.",
            cause,
          })
      )
    );

    if (bundle.id !== id) {
      return yield* new BundleError({
        reason: "invalid",
        message: "Selected bundle identity disagrees with the requested way.",
        next: "Inspect the acquisition store.",
      });
    }

    return bundle;
  });

export const acquireBundle = ({
  catalog,
  id,
  directory,
  expectedGeneration,
}: {
  readonly catalog: Catalog;
  readonly id: string;
  readonly directory: string;
  readonly expectedGeneration?: string;
}): Effect.Effect<AcquiredBundle, BundleError> =>
  Effect.gen(function* acquire() {
    if (
      expectedGeneration !== undefined &&
      expectedGeneration !== catalog.generation
    ) {
      return yield* new BundleError({
        reason: "generation-mismatch",
        message: "Requested generation differs from the admitted catalog.",
        next: "Retrieve a complete matching catalog before acquiring.",
      });
    }

    const selected = catalog.data.documents.find(
      (doc) => doc.id === id || doc.id === `workflow:${id}`
    );

    if (!selected) {
      return yield* new BundleError({
        reason: "not-found",
        message: `No public way ${id}.`,
        next: "Choose a document ID from au find.",
      });
    }

    const wanted = new Set<string>([selected.id]);
    const workflowIds = new Set<string>();

    const visit = (workflowId: string): void => {
      if (workflowIds.has(workflowId)) {
        return;
      }

      workflowIds.add(workflowId);
      wanted.add(`workflow:${workflowId}`);

      for (const workflow of catalog.data.workflows.filter(
        (row) => row.id === workflowId
      )) {
        for (const call of workflow.joins) {
          if (Predicate.isTagged(call, "call")) {
            visit(call.workflow);
          }
        }
      }
    };

    if (selected.kind === "workflow") {
      visit(selected.id.slice("workflow:".length));
    }

    const visitDocument = (documentId: string): void => {
      const document = catalog.data.documents.find(
        (row) => row.id === documentId
      );

      if (!document) {
        return;
      }

      for (const reference of document.references ?? []) {
        if (!wanted.has(reference)) {
          wanted.add(reference);
          visitDocument(reference);
        }
      }
    };

    for (const documentId of wanted) {
      visitDocument(documentId);
    }

    const requirements = catalog.workflowNeeds.get(selected.id) ?? [];

    const bundle: Bundle = {
      format: "agenticu-bundle/1",
      generation: catalog.generation,
      id: selected.id,
      workflows: catalog.data.workflows.filter((row) =>
        workflowIds.has(row.id)
      ),
      requirements: requirements.map((body) => ({ id: body.id, body })),
      documents: catalog.data.documents.filter((doc) => wanted.has(doc.id)),
    };

    const previous = yield* readSelectedBundle({
      directory,
      id: selected.id,
    }).pipe(
      Effect.catchTag("BundleError", (error) =>
        error.reason === "not-found" ? Effect.succeed(null) : Effect.fail(error)
      )
    );

    const before = new Map(
      previous?.requirements.map((row) => [row.id, JSON.stringify(row.body)])
    );

    const after = new Map(
      bundle.requirements.map((row) => [row.id, JSON.stringify(row.body)])
    );

    const changedRequirements = [
      ...new Set([...before.keys(), ...after.keys()]),
    ].filter((key) => before.get(key) !== after.get(key));

    const instructionsChanged =
      previous !== null &&
      (JSON.stringify(previous.documents) !==
        JSON.stringify(bundle.documents) ||
        JSON.stringify(previous.workflows) !==
          JSON.stringify(bundle.workflows));

    const affectedChecks = instructionsChanged
      ? [...new Set([...before.keys(), ...after.keys()])]
      : changedRequirements;

    const bytes = JSON.stringify(bundle);
    const hash = digest(bytes);
    yield* storage(() => installPackage(directory, selected.id, bytes, hash));

    return { bundle, digest: hash, changedRequirements, affectedChecks };
  });
