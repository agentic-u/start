// @effect-diagnostics-next-line nodeBuiltinImport:off -- Effect 4.1.5 has no crypto module; native SHA-256 must match the public producer bytes.
import { createHash } from "node:crypto";

import { defineContract, implement } from "@agentic-u/operations";
import { NodeFileSystem } from "@effect/platform-node";
import { Context, Effect, FileSystem, Predicate, Schema } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";

import { calls, handlers } from "./domain/calls.js";
import { Supply, libraryFindings } from "./domain/library.js";
import type { Library } from "./domain/library.js";
import { Workflow } from "./domain/workflow.js";

export { Workflow } from "./domain/workflow.js";

export { Supply } from "./domain/library.js";

const Text = Schema.NonEmptyString;

const JsonRecord = Schema.Record(Schema.String, Schema.Json);

export const Document = Schema.Struct({
  id: Text,
  kind: Schema.Literals([
    "workflow",
    "lesson",
    "runbook",
    "curriculum",
    "source",
    "claim",
  ]),
  title: Text,
  text: Text,
  references: Schema.optionalKey(Schema.Array(Text)),
});

const Data = Schema.Struct({
  workflows: Schema.Array(Workflow),
  needs: Schema.Array(Supply),
  curriculum: JsonRecord,
  documents: Schema.Array(Document),
});

const Envelope = Schema.Struct({
  format: Schema.Literal("agenticu-catalog/1"),
  generation: Text,
  data: Schema.Json,
});

export class CatalogError extends Schema.TaggedError<CatalogError>()(
  "CatalogError",
  {
    reason: Schema.Literals([
      "unavailable",
      "invalid",
      "generation-mismatch",
      "not-found",
      "unsupported",
    ]),
    message: Schema.String,
    next: Schema.String,
    cause: Schema.optionalKey(Schema.Unknown),
  }
) {}

export interface Catalog {
  readonly generation: string;
  readonly data: typeof Data.Type;
  readonly workflowNeeds: ReadonlyMap<string, readonly Supply[]>;
  readonly library: Library;
}

export class CatalogStore extends Context.Service<
  CatalogStore,
  { readonly load: Effect.Effect<Catalog, CatalogError> }
>()("@agentic-u/CatalogStore") {}

const invalid = (message: string) =>
  new CatalogError({
    reason: "invalid",
    message,
    next: "Rebuild the source catalog; all references must resolve in the public generation.",
  });

const dependencyCycle = (
  rows: readonly {
    readonly id: string;
    readonly dependencies: readonly string[];
  }[]
): readonly string[] | undefined => {
  const complete = new Set<string>();

  const visit = (
    row: (typeof rows)[number],
    path: readonly string[]
  ): readonly string[] | undefined => {
    const start = path.indexOf(row.id);

    if (start !== -1) {
      return [...path.slice(start), row.id];
    }

    if (complete.has(row.id)) {
      return;
    }

    for (const child of rows.filter((candidate) =>
      row.dependencies.includes(candidate.id)
    )) {
      const cycle = visit(child, [...path, row.id]);

      if (cycle) {
        return cycle;
      }
    }

    complete.add(row.id);
  };

  for (const row of rows) {
    const cycle = visit(row, []);

    if (cycle) {
      return cycle;
    }
  }
};

export const decodeCatalog = (
  text: string
): Effect.Effect<Catalog, CatalogError> =>
  Effect.gen(function* admitCatalog() {
    const envelope = yield* Schema.decodeUnknownEffect(
      Schema.fromJsonString(Envelope)
    )(text).pipe(
      Effect.mapError(
        (cause) =>
          new CatalogError({
            reason: "invalid",
            message: "Catalog is not an agenticu-catalog/1 document.",
            next: "Fetch the current public catalog or choose a generated catalog file.",
            cause,
          })
      )
    );

    const actual = createHash("sha256")
      .update(JSON.stringify(envelope.data))
      .digest("hex");

    if (actual !== envelope.generation) {
      return yield* new CatalogError({
        reason: "generation-mismatch",
        message: "Catalog bytes do not match the declared generation.",
        next: "Fetch the complete catalog again; do not mix generations.",
      });
    }

    const data = yield* Schema.decodeUnknownEffect(Data)(envelope.data).pipe(
      Effect.mapError(
        (cause) =>
          new CatalogError({
            reason: "invalid",
            message:
              "Catalog data does not satisfy the public reader contract.",
            next: "Use a supported generated catalog.",
            cause,
          })
      )
    );

    for (const [name, rows] of [
      ["document", data.documents],
      ["workflow", data.workflows],
      ["need", data.needs],
    ] as const) {
      if (new Set(rows.map((row) => row.id)).size !== rows.length) {
        return yield* invalid(`Catalog ${name} IDs are duplicated.`);
      }
    }

    const documentIds = new Set(data.documents.map((d) => d.id));

    for (const document of data.documents) {
      for (const reference of document.references ?? []) {
        if (!documentIds.has(reference)) {
          return yield* invalid(
            `Document ${document.id} refers to absent public document ${reference}.`
          );
        }
      }
    }

    for (const w of data.workflows) {
      if (!documentIds.has(`workflow:${w.id}`)) {
        return yield* invalid(`Workflow ${w.id} has no public document.`);
      }
    }

    const workflowCycle = dependencyCycle(
      data.workflows.map((workflow) => ({
        id: workflow.id,
        dependencies: workflow.joins.flatMap((join) =>
          Predicate.isTagged(join, "call") ? [join.workflow] : []
        ),
      }))
    );

    const needCycle = dependencyCycle(
      data.needs.map((need) => ({ id: need.id, dependencies: need.asks ?? [] }))
    );

    if (workflowCycle || needCycle) {
      return yield* invalid(
        `Catalog dependency cycle: ${(workflowCycle ?? needCycle ?? []).join(" -> ")}.`
      );
    }

    const library: Library = {
      workflows: new Map(
        data.workflows.map((workflow) => [workflow.id, workflow])
      ),
      needs: new Map(data.needs.map((need) => [need.id, need])),
    };

    const findings = libraryFindings(library);

    if (findings.length > 0) {
      return yield* invalid(findings.join("; "));
    }

    const workflowNeeds = new Map<string, readonly Supply[]>();

    for (const root of data.workflows) {
      const visited = new Set<string>();
      const wanted = new Set<string>();

      const visitNeed = (id: string): void => {
        if (wanted.has(id)) {
          return;
        }

        wanted.add(id);

        for (const supply of data.needs.filter(
          (candidate) => candidate.id === id
        )) {
          for (const ask of supply.asks ?? []) {
            visitNeed(ask);
          }
        }
      };

      const visit = (w: typeof root): void => {
        if (visited.has(w.id)) {
          return;
        }

        visited.add(w.id);

        for (const n of w.needs) {
          visitNeed(n.id);
        }

        for (const t of w.things) {
          if (t.comes_from === "brought") {
            visitNeed(t.id);
          }
        }

        for (const join of w.joins) {
          if (Predicate.isTagged(join, "call")) {
            for (const child of data.workflows.filter(
              (c) => c.id === join.workflow
            )) {
              visit(child);
            }
          }
        }
      };

      visit(root);
      workflowNeeds.set(
        `workflow:${root.id}`,
        data.needs.filter((n) => wanted.has(n.id))
      );
    }

    return { generation: envelope.generation, data, workflowNeeds, library };
  });

export const loadCatalog = (
  source: string
): Effect.Effect<Catalog, CatalogError> =>
  Effect.gen(function* readCatalogSource() {
    if (!/^https?:\/\//u.test(source)) {
      // @effect-diagnostics-next-line unstableApiUsage:off -- Official filesystem service is pinned to Effect 4.1.5 at this file boundary.
      const fs = yield* FileSystem.FileSystem;

      return yield* fs.readFileString(source);
    }

    // @effect-diagnostics-next-line unstableApiUsage:off -- Official HTTP client is pinned to Effect 4.1.5 at this network boundary.
    const response = yield* HttpClient.get(source);

    if (response.status < 200 || response.status >= 300) {
      return yield* new CatalogError({
        reason: "unavailable",
        message: `Catalog HTTP ${response.status}.`,
        next: "Check the public URL or pass a generated local file.",
      });
    }

    return yield* response.text;
  }).pipe(
    // @effect-diagnostics-next-line unstableApiUsage:off -- Official filesystem and fetch adapters are pinned to Effect platform-node 4.1.5.
    Effect.provide([NodeFileSystem.layer, FetchHttpClient.layer]),
    Effect.mapError(
      (cause) =>
        new CatalogError({
          reason: "unavailable",
          message: `Could not read catalog ${source}.`,
          next: "Check the source or pass --catalog with a generated local file.",
          cause,
        })
    ),
    Effect.flatMap(decodeCatalog)
  );

const annotations = {
  readOnly: true,
  destructive: false,
  idempotent: true,
  openWorld: false,
};

const result = <F extends Schema.Struct.Fields>(fields: F) =>
  Schema.Struct({ generation: Text, ...fields });

const missing = (id: string) =>
  new CatalogError({
    reason: "not-found",
    message: `No public way named ${id}.`,
    next: "Run au find to list public document IDs.",
  });

const documentOf = (catalog: Catalog, id: string) =>
  catalog.data.documents.find((d) => d.id === id || d.id === `workflow:${id}`);

const findContract = defineContract("find", {
  description:
    "Find public ways by words. Returns matching IDs, kinds and titles at one catalog generation.",
  input: Schema.Struct({ words: Schema.optionalKey(Schema.String) }),
  output: result({
    ...calls.find.output.fields,
    documents: Schema.Array(
      Schema.Struct({ id: Text, kind: Document.fields.kind, title: Text })
    ),
  }),
  failure: CatalogError,
  annotations,
});

const readContract = defineContract("read", {
  description:
    "Read a complete public way, preserving the source instructions and catalog generation.",
  input: calls.read.input,
  output: result({
    ...calls.read.output.fields,
    document: Schema.optionalKey(Document),
  }),
  failure: CatalogError,
  annotations,
});

const needsContract = defineContract("needs", {
  description:
    "Read the recursive workflow requirements and their checks. This does not verify the house's tools or confer authority.",
  input: calls.needs.input,
  output: result(calls.needs.output.fields),
  failure: CatalogError,
  annotations,
});

export const find = implement(findContract, ({ words = "" }) =>
  Effect.gen(function* findDocuments() {
    const { load } = yield* CatalogStore;
    const catalog = yield* load;
    const terms = words.toLowerCase().split(/\s+/u).filter(Boolean);

    const found = yield* handlers(catalog.library)
      .find({ words })
      .pipe(Effect.mapError((failure) => missing(failure.not_here.join(", "))));

    return {
      ...found,
      generation: catalog.generation,
      documents: catalog.data.documents.flatMap((document) =>
        document.kind !== "workflow" &&
        terms.every((term) =>
          `${document.id} ${document.title} ${document.text}`
            .toLowerCase()
            .includes(term)
        )
          ? [{ id: document.id, kind: document.kind, title: document.title }]
          : []
      ),
    };
  })
);

export const read = implement(readContract, ({ id, step }) =>
  Effect.gen(function* readDocument() {
    const { load } = yield* CatalogStore;
    const catalog = yield* load;
    const document = documentOf(catalog, id);

    if (!document) {
      return yield* missing(id);
    }

    if (document.kind !== "workflow") {
      if (step !== undefined) {
        return yield* new CatalogError({
          reason: "unsupported",
          message: `${id} is a document, not a workflow with steps.`,
          next: "Read the document without --step.",
        });
      }

      return { generation: catalog.generation, document };
    }

    const workflowId = document.id.slice("workflow:".length);

    const selected = yield* handlers(catalog.library)
      .read(step === undefined ? { id: workflowId } : { id: workflowId, step })
      .pipe(
        Effect.mapError(
          (failure) =>
            new CatalogError({
              reason: "not-found",
              message: `No public workflow or step named ${failure.not_here.join(", ")}.`,
              next: failure.try,
            })
        )
      );

    return step === undefined
      ? { ...selected, generation: catalog.generation, document }
      : { ...selected, generation: catalog.generation };
  })
);

export const needs = implement(needsContract, ({ id }) =>
  Effect.gen(function* readRequirements() {
    const { load } = yield* CatalogStore;
    const catalog = yield* load;
    const doc = documentOf(catalog, id);

    if (!doc) {
      return yield* missing(id);
    }

    if (doc.kind !== "workflow") {
      return yield* new CatalogError({
        reason: "unsupported",
        message: `${doc.id} has no declared workflow requirements.`,
        next: "Choose a workflow ID from au find; read curriculum instructions with au read.",
      });
    }

    const requirements = yield* handlers(catalog.library)
      .needs({ id: doc.id.slice("workflow:".length) })
      .pipe(Effect.mapError((failure) => missing(failure.not_here.join(", "))));

    return { ...requirements, generation: catalog.generation };
  })
);

const readyContract = defineContract("ready", {
  description:
    "Plan against need IDs you claim are present. No local tools are verified and no authority is granted. Nothing is stored or sent to the public catalog.",
  input: calls.ready.input,
  output: result({
    ...calls.ready.output.fields,
    basis: Schema.Literal("claimed-ids-only"),
  }),
  failure: CatalogError,
  annotations,
});

export const ready = implement(readyContract, (input) =>
  Effect.gen(function* planClaimedSetup() {
    const { load } = yield* CatalogStore;
    const catalog = yield* load;
    const document = documentOf(catalog, input.id);

    if (!document) {
      return yield* missing(input.id);
    }

    if (document.kind !== "workflow") {
      return yield* new CatalogError({
        reason: "unsupported",
        message: `${input.id} has no declared workflow readiness plan.`,
        next: "Choose a workflow ID from au find.",
      });
    }

    const planned = yield* handlers(catalog.library)
      .ready({ id: document.id.slice("workflow:".length), have: input.have })
      .pipe(
        Effect.mapError(
          (failure) =>
            new CatalogError({
              reason: "not-found",
              message:
                failure.not_here.length > 0
                  ? `No public workflow named ${failure.not_here.join(", ")}.`
                  : "Some claimed need IDs are not in the public catalog.",
              next: failure.try,
            })
        )
      );

    return {
      ...planned,
      generation: catalog.generation,
      basis: "claimed-ids-only" as const,
    };
  })
);

export const operations = [find, read, needs, ready] as const;
