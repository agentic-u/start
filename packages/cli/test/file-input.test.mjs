import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const binary =
  process.env.AU_BIN ??
  fileURLToPath(new URL("../dist/main.js", import.meta.url));

const catalog =
  process.env.AU_CATALOG ??
  fileURLToPath(
    new URL("../../catalog/test/fixtures/catalog.json", import.meta.url)
  );

const house = await mkdtemp(path.join(tmpdir(), "agenticu-file-input-"));

const invoke = (operation, input, ...flags) =>
  spawnSync(
    process.execPath,
    [
      binary,
      "--catalog",
      catalog,
      "--house",
      house,
      "call",
      operation,
      "--input",
      input,
      ...flags,
    ],
    { encoding: "utf-8", timeout: 15_000 }
  );

const inputFile = async (name, payload) => {
  const location = path.join(house, name);
  await writeFile(location, JSON.stringify(payload));

  return location;
};

test("file-input call invokes the actual local operation and the bounded execute projection", async () => {
  const getFile = await inputFile("get.json", { way: "runtime:git" });
  const get = invoke("get", getFile);

  assert.equal(get.status, 0, get.stderr);
  assert.equal(JSON.parse(get.stdout).way, "runtime:git");

  const executeFile = await inputFile("execute.json", {
    code: "const found=await tools.find({words:'browser'}); const read=await tools.read({id:'curriculum'}); return {count:found.found.length,title:read.document.title};",
  });

  const executed = invoke("execute", executeFile);

  assert.equal(executed.status, 0, executed.stderr);
  const output = JSON.parse(executed.stdout);

  assert.deepEqual(output.toolCalls, ["find", "read"]);
  assert.equal(output.result.title, "The curriculum");
});

test("file-input call preserves donor unknown-operation and exact-input failures", async () => {
  const empty = await inputFile("empty.json", {});
  const unknown = invoke("not-an-operation", empty);
  const invalid = invoke("read", empty);

  assert.notEqual(unknown.status, 0);
  assert.equal(JSON.parse(unknown.stderr)._tag, "UnknownCapability");
  assert.notEqual(invalid.status, 0);
  assert.equal(JSON.parse(invalid.stderr)._tag, "InvalidInput");
});

test("file-input syntax and filesystem failures are typed and nonzero", async () => {
  const malformed = path.join(house, "malformed.json");
  await writeFile(malformed, "{broken");
  const invalid = invoke("read", malformed);
  const absent = invoke("read", path.join(house, "absent.json"));

  assert.notEqual(invalid.status, 0);
  assert.equal(JSON.parse(invalid.stderr).reason, "invalid-json");
  assert.notEqual(absent.status, 0);
  assert.equal(JSON.parse(absent.stderr).reason, "read");
});

test("file content grants no authority and explicit yes applies only to one invocation", async () => {
  const acceptance = await inputFile("accept.json", {
    yes: true,
    command: {
      kind: "accepted",
      key: "file-accept",
      way: "answer-with-a-receipt",
      version: "1",
      at: "2026-01-01T00:00:00Z",
      attempt: "absent-attempt",
      checkKey: "absent-check",
      principal: "test-principal",
      decision: "accepted",
      note: "must not become an accepted receipt",
    },
  });

  const denied = invoke("accept", acceptance);
  const permitted = invoke("accept", acceptance, "--yes");
  const deniedAgain = invoke("accept", acceptance);

  assert.notEqual(denied.status, 0);
  assert.equal(JSON.parse(denied.stderr)._tag, "ApprovalDenied");
  assert.notEqual(permitted.status, 0);
  assert.equal(JSON.parse(permitted.stderr)._tag, "ProgressError");
  assert.equal(JSON.parse(permitted.stderr).reason, "missing-reference");
  assert.notEqual(deniedAgain.status, 0);
  assert.equal(JSON.parse(deniedAgain.stderr)._tag, "ApprovalDenied");
});
