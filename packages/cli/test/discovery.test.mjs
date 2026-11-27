import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const binary =
  process.env.AU_BIN ??
  fileURLToPath(new URL("../dist/main.js", import.meta.url));

const run = (...args) =>
  spawnSync(
    process.execPath,
    [binary, "--catalog", "/absent/catalog.json", ...args],
    { encoding: "utf-8", timeout: 15_000 }
  );

test("staff discovers a small map and one exact contract without network or private state", () => {
  const map = run("catalog");
  assert.equal(map.status, 0, map.stderr);
  const inventory = JSON.parse(map.stdout);
  assert.ok(map.stdout.length < 16_000);
  assert.ok(inventory.capabilities.some((entry) => entry.name === "record"));
  assert.ok(inventory.capabilities.some((entry) => entry.name === "job_list"));
  assert.ok(
    inventory.capabilities.every((entry) => !Object.hasOwn(entry, "input"))
  );
  assert.match(inventory.next, /catalog --operation/u);
  const record = run("catalog", "--operation", "record");
  assert.equal(record.status, 0, record.stderr);
  const contract = JSON.parse(record.stdout);
  assert.equal(contract.name, "record");
  assert.ok(contract.input);
  assert.ok(contract.output);
  assert.ok(contract.failure);
  const exported = run("catalog", "--full");
  assert.equal(exported.status, 0, exported.stderr);
  assert.deepEqual(
    contract,
    JSON.parse(exported.stdout).capabilities.find(
      (entry) => entry.name === "record"
    )
  );
  const missing = run("catalog", "--operation", "absent");
  assert.equal(missing.status, 1);
  assert.equal(JSON.parse(missing.stderr)._tag, "UnknownCapability");
  assert.match(JSON.parse(missing.stderr).next, /au catalog/u);
});

test("staff navigation does not embed code-mode declarations and file input explains approval", () => {
  const help = run("--help");
  assert.equal(help.status, 0, help.stderr);
  assert.doesNotMatch(help.stdout, /declare const tools|PARTIAL/u);
  assert.match(help.stdout, /catalog --operation/u);
  const call = run("call", "--help");
  assert.equal(call.status, 0, call.stderr);
  assert.match(call.stdout, /file content grants no authority/u);
  assert.match(call.stdout, /invocation only/u);
});
