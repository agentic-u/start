import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { promisify } from "node:util";

const { join } = pathModule;

const exec = promisify(execFile);

const base = {
  way: "workflow:review",
  version: "v1",
  at: "2026-11-26T12:00:00Z",
};

const view = { ...base, key: "view", kind: "viewed" };

const child = (path, command) =>
  exec(process.execPath, [
    new URL("process.mjs", import.meta.url).pathname,
    path,
    ...(command ? [JSON.stringify(command)] : []),
  ]);

const run = child;

const read = async (path) => {
  const result = await child(path);

  return JSON.parse(result.stdout);
};

test("durable distinctions, idempotency, checked references, fresh process", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "au-progress-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "progress.sqlite");
  await run(path, view);
  await run(path, {
    ...base,
    key: "start",
    kind: "started",
    attempt: "a",
    originalInput: { owner: "keep exact words" },
  });
  await run(path, {
    ...base,
    key: "artifact",
    kind: "artifact",
    attempt: "a",
    artifact: "draft.md",
    interpretation: { summary: "agent interpretation" },
  });
  await run(path, {
    ...base,
    key: "check",
    kind: "checked",
    attempt: "a",
    artifactKey: "artifact",
    result: "failed",
    evidence: ["test-log.txt"],
    checkedBy: "agent",
  });
  let fresh = await read(path);
  assert.deepEqual(
    fresh.map((x) => x.kind),
    ["viewed", "started", "artifact", "checked"]
  );
  await run(path, {
    ...base,
    key: "decision",
    kind: "accepted",
    attempt: "a",
    checkKey: "check",
    principal: "fictional-principal",
    decision: "rejected",
    note: "needs work",
  });
  await run(path, view);
  const saved = await read(path);
  assert.equal(saved.length, 5);
  await assert.rejects(run(path, { ...view, version: "v2" }), /Idempotency/u);
  await assert.rejects(
    run(path, {
      ...base,
      key: "bad",
      kind: "checked",
      attempt: "a",
      artifactKey: "absent",
      result: "passed",
      evidence: ["x"],
      checkedBy: "agent",
    }),
    /artifact/u
  );
  await assert.rejects(run(path, { ...view, at: "yesterday" }));
  fresh = await read(path);
  assert.equal(fresh.length, 5);
  assert.equal(fresh[1].originalInput.owner, "keep exact words");
  await run(path, {
    ...base,
    key: "accept",
    kind: "accepted",
    attempt: "a",
    checkKey: "check",
    principal: "fictional-principal",
    decision: "accepted",
    note: "accepting this draft despite failed check",
  });
  fresh = await read(path);
  assert.equal(fresh[5].decision, "accepted");
  assert.equal(fresh[3].result, "failed");
});

test("concurrent processes never lose receipts or duplicate keys", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "au-progress-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "p.sqlite");
  await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      child(path, { ...view, key: `v${i % 6}` })
    )
  );
  const saved = await read(path);
  assert.equal(saved.length, 6);
});

test("killed uncommitted writer rolls back; corruption remains visible and unchanged", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "au-progress-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "p.sqlite");
  await run(path, view);

  const writer = spawn(process.execPath, [
    new URL("interrupted.mjs", import.meta.url).pathname,
    path,
  ]);

  await once(writer.stdout, "data");
  const stopped = once(writer, "exit");
  writer.kill("SIGKILL");
  await stopped;
  const saved = await read(path);
  assert.equal(saved.length, 1);
  const db = new DatabaseSync(path);
  db.prepare("INSERT INTO receipts(body) VALUES (?)").run("{broken");
  db.close();
  const before = await readFile(path);
  await assert.rejects(child(path), /Existing bytes are preserved/u);
  assert.deepEqual(await readFile(path), before);
  const bad = join(dir, "bad.sqlite");
  await writeFile(bad, "this is not sqlite");
  const bytes = await readFile(bad);
  await assert.rejects(run(bad, view));
  assert.deepEqual(await readFile(bad), bytes);
});
