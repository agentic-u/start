import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { CatalogStore, decodeCatalog } from "@agentic-u/catalog";
import {
  Approval,
  toCommand,
  toToolkit,
  toHttpApi,
} from "@agentic-u/operations";
import { it } from "@effect/vitest";
import { Effect, Schema, Stream } from "effect";

import * as House from "../dist/index.js";

const bytes = readFileSync(
  new URL("../../catalog/test/fixtures/catalog.json", import.meta.url),
  "utf-8"
);

const exec = promisify(execFile);

const runAt = (directory, operation, selectedCatalog) =>
  operation.pipe(
    Effect.provideService(House.House, { directory }),
    Effect.provideService(CatalogStore, {
      load: Effect.succeed(selectedCatalog),
    }),
    Effect.provide(Approval.denyAll)
  );

it.effect(
  "real git binding, fresh-agent history, approval denial and complete bundle updates",
  () =>
    Effect.gen(function* provesHouseOperations() {
      const catalog = yield* decodeCatalog(bytes);

      const directory = yield* Effect.acquireRelease(
        Effect.sync(() => mkdtempSync(path.join(tmpdir(), "agenticu-house-"))),
        (acquiredDirectory) =>
          Effect.sync(() =>
            rmSync(acquiredDirectory, { recursive: true, force: true })
          )
      );

      const run = (operation) => runAt(directory, operation, catalog);
      yield* Effect.promise(() => exec("git", ["init", directory]));
      const planned = yield* run(House.plan.handler({ way: "runtime:git" }));
      assert.equal(planned.selected, false);
      yield* run(House.get.handler({ way: "runtime:git" }));
      yield* run(
        House.bind.handler({
          requirement: "runtime:git",
          selection: {
            adapter: "git",
            endpoint: { kind: "git", repository: directory },
            account: null,
          },
        })
      );
      const checked = yield* run(House.check.handler({ way: "runtime:git" }));
      assert.equal(checked[0].result, "passed");
      const status = yield* run(House.status.handler({}));
      assert.equal(status.ways[0].requirements[0].state, "passed");

      const common = {
        way: "fictional:review",
        version: "1",
        at: "2026-11-26T12:00:00Z",
        attempt: "attempt-1",
      };

      const commands = [
        {
          ...common,
          key: "start",
          kind: "started",
          originalInput: { fictional: true },
        },
        {
          ...common,
          key: "artifact",
          kind: "artifact",
          artifact: "draft.md",
          interpretation: { status: "draft" },
        },
        {
          ...common,
          key: "checked",
          kind: "checked",
          artifactKey: "artifact",
          result: "passed",
          evidence: ["reviewed draft"],
          checkedBy: "agent",
        },
      ];

      for (const command of commands) {
        yield* run(House.record.handler({ command }));
      }

      yield* run(House.record.handler({ command: commands[2] }));

      const acceptance = {
        ...common,
        key: "accept",
        kind: "accepted",
        checkKey: "checked",
        principal: "arbitrary-agent-label",
        decision: "accepted",
        note: "untrusted assertion",
      };

      assert.throws(() =>
        Schema.decodeUnknownSync(House.record.contract.input)({
          command: acceptance,
        })
      );

      const denied = yield* run(
        Effect.flip(House.accept.handler({ command: acceptance }))
      );

      assert.equal(denied._tag, "ApprovalDenied");
      const resumed = yield* run(House.resume.handler({}));
      assert.deepEqual(resumed, commands);

      const workflow = catalog.data.documents.find(
        (doc) => doc.kind === "workflow"
      );

      const first = yield* run(
        House.acquireBundle.handler({ id: workflow.id })
      );

      const bundle = yield* run(House.readBundle.handler({ id: workflow.id }));
      assert.deepEqual(bundle, first.bundle);
      const updated = JSON.parse(bytes);
      updated.data.documents.find((doc) => doc.id === workflow.id).text +=
        "\nupdated instruction";
      updated.generation = createHash("sha256")
        .update(JSON.stringify(updated.data))
        .digest("hex");
      const newer = yield* decodeCatalog(JSON.stringify(updated));

      const second = yield* runAt(
        directory,
        House.acquireBundle.handler({
          id: workflow.id,
          expectedGeneration: newer.generation,
        }),
        newer
      );

      assert.notEqual(second.digest, first.digest);
      assert.deepEqual(
        second.affectedChecks,
        first.bundle.requirements.map((row) => row.id)
      );
    })
);

it.effect(
  "generated toolkit invokes the same typed handler and every operation projects",
  () =>
    Effect.gen(function* provesProjectionParity() {
      const catalog = yield* decodeCatalog(bytes);

      const directory = yield* Effect.acquireRelease(
        Effect.sync(() =>
          mkdtempSync(path.join(tmpdir(), "agenticu-house-projection-"))
        ),
        (acquiredDirectory) =>
          Effect.sync(() =>
            rmSync(acquiredDirectory, { recursive: true, force: true })
          )
      );

      const projection = toToolkit(House.houseOperations);

      const direct = yield* runAt(
        directory,
        House.get.handler({ way: "runtime:git" }),
        catalog
      );

      const result = yield* runAt(
        directory,
        Effect.gen(function* invokesToolkit() {
          const toolkit = yield* projection.toolkit;
          const stream = yield* toolkit.handle("get", { way: "runtime:git" });

          return yield* Stream.runCollect(stream);
        }).pipe(Effect.provide(projection.layer)),
        catalog
      );

      assert.equal(result.length, 1);
      assert.deepEqual(result[0].result, direct);
      assert.ok(
        toHttpApi("house", House.houseOperations).api.groups.capabilities
          .endpoints.get
      );

      for (const operation of House.houseOperations) {
        assert.ok(toCommand(operation, { promptForApproval: false }));
        assert.equal("house" in operation.contract.input.fields, false);
      }
    })
);
