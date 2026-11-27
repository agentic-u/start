import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { Schema } from "effect";

const root = path.resolve(import.meta.dirname, "..");

const scratch = mkdtempSync(path.join(tmpdir(), "agenticu-cold-"));

const run = (command, args, cwd = scratch) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, NODE_PATH: "" },
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `${command} exited ${result.status}\n${result.stderr}\n${result.stdout}`
    );
  }

  return result.stdout;
};

try {
  const release = path.join(scratch, "release");

  const house = path.join(scratch, "house");

  run(process.execPath, [
    path.join(root, "scripts/pack-runtime.mjs"),
    "--out",
    release,
  ]);

  const installed = Schema.decodeUnknownSync(
    Schema.fromJsonString(
      Schema.Struct({
        node: Schema.String,
        entry: Schema.String,
        status: Schema.Literal("installed"),
      })
    )
  )(
    run("python3", [
      path.join(root, "tools/runtime.py"),
      "install",
      "--release",
      release,
      "--house",
      house,
    ])
  );

  copyFileSync(
    path.join(root, "packages/catalog/test/fixtures/catalog.json"),
    path.join(scratch, "catalog.json")
  );

  const fixture = JSON.parse(
    readFileSync(path.join(scratch, "catalog.json"), "utf-8")
  );

  const [workflow] = fixture.data.workflows;

  const needs = JSON.parse(
    run(installed.node, [
      installed.entry,
      "--catalog",
      "catalog.json",
      "needs",
      workflow.id,
    ])
  );

  assert.equal(needs.generation, fixture.generation);

  const absent = spawnSync(
    installed.node,
    [
      installed.entry,
      "--catalog",
      "catalog.json",
      "needs",
      "absent-cold-workflow",
    ],
    { cwd: scratch, encoding: "utf-8" }
  );

  assert.notEqual(absent.status, 0);

  const failure = Schema.decodeUnknownSync(
    Schema.fromJsonString(
      Schema.Struct({
        reason: Schema.Literal("not-found"),
        message: Schema.String,
        next: Schema.String,
      })
    )
  )(absent.stderr);

  assert.equal(failure.reason, "not-found");
  assert.ok(failure.message.length > 0);
  assert.ok(failure.next.length > 0);
  process.stdout.write(
    "cold package consumer: known workflow and typed missing workflow passed\n"
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
