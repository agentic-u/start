import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { it } from "@effect/vitest";
import { Effect, Predicate } from "effect";

import {
  CatalogStore,
  decodeCatalog,
  find,
  read,
  needs,
  ready,
} from "../dist/index.js";

const bytes = await readFile(
  new URL("fixtures/catalog.json", import.meta.url),
  "utf-8"
);

const source = JSON.parse(bytes);

const golden = JSON.parse(
  await readFile(
    new URL("fixtures/native-calls.json", import.meta.url),
    "utf-8"
  )
);

const changed = (mutate) => {
  const envelope = structuredClone(source);

  mutate(envelope.data);
  envelope.generation = createHash("sha256")
    .update(JSON.stringify(envelope.data))
    .digest("hex");

  return JSON.stringify(envelope);
};

it.effect(
  "admits the generated public export and retains source documents and references",
  () =>
    Effect.gen(function* admitPublicSource() {
      const catalog = yield* decodeCatalog(bytes);

      const found = yield* find
        .handler({ words: "" })
        .pipe(
          Effect.provideService(CatalogStore, { load: Effect.succeed(catalog) })
        );

      const document = source.data.documents.find(
        (entry) => entry.kind === "lesson"
      );

      const result = yield* read
        .handler({ id: document.id })
        .pipe(
          Effect.provideService(CatalogStore, { load: Effect.succeed(catalog) })
        );

      assert.equal(catalog.generation, source.generation);
      assert.deepEqual(catalog.data.documents, source.data.documents);
      assert.equal(
        found.found.length + found.documents.length,
        source.data.documents.length
      );
      assert.deepEqual(result.document, document);
    })
);

it.effect(
  "hash mismatch, private workflows, duplicates, cycles and unresolved references fail admission",
  () =>
    Effect.gen(function* refuseInvalidPublicData() {
      const tampered = structuredClone(source);

      tampered.data.documents[0].text += " changed";

      const mismatch = yield* Effect.flip(
        decodeCatalog(JSON.stringify(tampered))
      );

      assert.equal(mismatch.reason, "generation-mismatch");

      const call = source.data.workflows
        .flatMap((workflow) => workflow.joins)
        .find((join) => Predicate.isTagged(join, "call"));

      const mutations = [
        (data) => {
          data.workflows[0].sight = "private";
        },
        (data) => {
          data.documents.push(data.documents[0]);
        },
        (data) => {
          data.documents[0].references = ["absent"];
        },
        (data) => {
          data.workflows[0].joins.push({ ...call, workflow: "absent" });
        },
        (data) => {
          data.workflows[0].needs.push({
            id: "absent",
            name: "Absent",
            sort: "tool",
          });
        },
        (data) => {
          data.needs[0].asks = ["absent"];
        },
        (data) => {
          data.needs[0].asks = [data.needs[0].id];
        },
        (data) => {
          data.workflows[0].joins.push({
            ...call,
            workflow: data.workflows[0].id,
          });
        },
      ];

      const failures = yield* Effect.all(
        mutations.map((mutation) =>
          Effect.flip(decodeCatalog(changed(mutation)))
        )
      );

      for (const failure of failures) {
        assert.equal(failure.reason, "invalid");
      }
    })
);

it.effect(
  "unknown IDs and undeclared curriculum requirements remain explicit failures",
  () =>
    Effect.gen(function* refuseUnknownWays() {
      const catalog = yield* decodeCatalog(bytes);

      const unknown = yield* Effect.flip(
        read.handler({ id: "absent" }).pipe(
          Effect.provideService(CatalogStore, {
            load: Effect.succeed(catalog),
          })
        )
      );

      const unsupported = yield* Effect.flip(
        needs.handler({ id: "curriculum" }).pipe(
          Effect.provideService(CatalogStore, {
            load: Effect.succeed(catalog),
          })
        )
      );

      assert.equal(unknown.reason, "not-found");
      assert.equal(unsupported.reason, "unsupported");
    })
);

it.effect(
  "all original workflow and conditional readiness behavior matches native source golden cases",
  () =>
    Effect.gen(function* preserveNativeCalls() {
      const catalog = yield* decodeCatalog(bytes);
      const operations = { find, read, needs, ready };

      yield* Effect.all(
        golden.cases.map((example) =>
          Effect.gen(function* compareNativeCase() {
            const projected = yield* operations[example.operation]
              .handler(example.input)
              .pipe(
                Effect.provideService(CatalogStore, {
                  load: Effect.succeed(catalog),
                })
              );

            const { generation, document, documents, basis, ...preserved } =
              projected;

            assert.equal(generation, source.generation);
            assert.deepEqual(
              preserved,
              example.output,
              `${example.operation} ${JSON.stringify(example.input)}`
            );

            if (example.operation === "ready") {
              assert.equal(basis, "claimed-ids-only");
            }
          })
        )
      );
    })
);
