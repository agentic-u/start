import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { decodeCatalog } from "@agentic-u/catalog";
import { Data, Effect } from "effect";

import { acquireBundle, readSelectedBundle } from "../dist/index.js";

const run = Effect.runPromise;

const { join } = path;

const workflow = (id, joins, needs = []) => ({
  id,
  title: id,
  sight: "public",
  version: "1",
  goal: "draft",
  standing: false,
  history: [],
  stages: [],
  lanes: [],
  actors: [],
  needs,
  things: [],
  gates: [],
  rules: [],
  measures: [],
  known: { facts: [], unknowns: [], tacit: [], blind_spots: [] },
  steps: joins.length
    ? [
        {
          id: "invoke",
          name: "invoke",
          by: { not_said: "actor unresolved" },
          takes: [],
          makes: [],
          needs: [],
          before: [],
          after: [],
          judgment: "fixed",
          harm: "reads",
          may_touch: [],
          settles: [],
        },
      ]
    : [],
  joins,
});

const { call } = Data.taggedEnum();

const catalog = (check = "confirm account") => {
  const need = {
    id: "../../private",
    name: "account",
    sort: "tool",
    why: "deliver",
    have_it_when: check,
    tells: "agent",
    ways: [],
    asks: ["dependent"],
  };

  const data = {
    workflows: [
      workflow("a", [call({ workflow: "b", step: "invoke", version: "1" })]),
      workflow("b", [], [{ id: need.id, name: "account", sort: "tool" }]),
    ],
    needs: [need, { ...need, id: "dependent", asks: [] }],
    curriculum: {},
    documents: [
      {
        id: "workflow:a",
        kind: "workflow",
        title: "a",
        text: "exact\n instructions\n  preserved",
        references: ["claim:one"],
      },
      { id: "workflow:b", kind: "workflow", title: "b", text: "called body" },
      {
        id: "claim:one",
        kind: "claim",
        title: "claim",
        text: "interpretation",
        references: ["source:one"],
      },
      {
        id: "source:one",
        kind: "source",
        title: "source",
        text: "original bytes",
      },
      {
        id: "source:unrelated",
        kind: "source",
        title: "unrelated",
        text: "exclude me",
      },
    ],
  };

  return run(
    decodeCatalog(
      JSON.stringify({
        format: "agenticu-catalog/1",
        generation: createHash("sha256")
          .update(JSON.stringify(data))
          .digest("hex"),
        data,
      })
    )
  );
};

test("filesystem consumer retains exact recursive scoped content and updates without touching private material", async () => {
  const directory = await mkdtemp(join(tmpdir(), "au-bundles-"));

  try {
    await writeFile(join(directory, "private.txt"), "private original");

    const first = await run(
      acquireBundle({ catalog: await catalog(), id: "a", directory })
    );

    const selected = await run(
      readSelectedBundle({ directory, id: "workflow:a" })
    );

    assert.deepEqual(
      await run(readSelectedBundle({ directory, id: "a" })),
      selected
    );

    const qualified = await run(
      acquireBundle({ catalog: await catalog(), id: "workflow:a", directory })
    );

    assert.equal(qualified.digest, first.digest);

    assert.equal(
      selected.documents[0].text,
      "exact\n instructions\n  preserved"
    );
    assert.deepEqual(
      selected.documents.map((row) => row.id),
      ["workflow:a", "workflow:b", "claim:one", "source:one"]
    );
    assert.equal(selected.workflows.length, 2);
    assert.deepEqual(
      selected.requirements.map((row) => row.id),
      ["../../private", "dependent"]
    );

    const updated = await run(
      acquireBundle({
        catalog: await catalog("confirm current account"),
        id: "a",
        directory,
      })
    );

    assert.deepEqual(updated.changedRequirements, [
      "../../private",
      "dependent",
    ]);
    assert.deepEqual(updated.affectedChecks, updated.changedRequirements);
    assert.equal(
      await readFile(join(directory, "private.txt"), "utf-8"),
      "private original"
    );
    assert.equal(
      JSON.parse(
        await readFile(
          join(directory, "packages", `${first.digest}.json`),
          "utf-8"
        )
      ).generation,
      first.bundle.generation
    );
    const packages = await readdir(join(directory, "packages"));
    assert.equal(packages.length, 2);

    const current = await run(
      readSelectedBundle({ directory, id: "workflow:a" })
    );

    assert.equal(current.generation, updated.bundle.generation);

    const refused = await run(
      acquireBundle({
        catalog: await catalog(),
        id: "a",
        directory,
        expectedGeneration: "wrong",
      }).pipe(Effect.flip)
    );

    assert.equal(refused.reason, "generation-mismatch");

    const unchanged = await run(
      readSelectedBundle({ directory, id: "workflow:a" })
    );

    assert.equal(unchanged.generation, current.generation);

    const selectionName = createHash("sha256")
      .update("workflow:a")
      .digest("hex");

    await writeFile(
      join(directory, "selections", `${selectionName}.json`),
      JSON.stringify({ digest: "../../private.txt" })
    );

    const invalid = await run(
      readSelectedBundle({ directory, id: "workflow:a" }).pipe(Effect.flip)
    );

    assert.equal(invalid.reason, "invalid");
    assert.equal(
      await readFile(join(directory, "private.txt"), "utf-8"),
      "private original"
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
