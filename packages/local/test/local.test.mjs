import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

import { Effect, Schema } from "effect";

import {
  plan,
  get,
  bind,
  check,
  status,
  authorize,
  giveGrant,
  revokeGrant,
  PlanOutput,
  StatusOutput,
  CheckOutput,
  admitSelection,
} from "../dist/index.js";

const run = Effect.runPromise;

const { join } = path;

const catalog = {
  generation: "fictional-generation-one",
  data: { workflows: [], needs: [], documents: [], curriculum: {} },
  workflowNeeds: new Map(),
};

test("real git journey: missing, immutable failed and passed receipts, exact stale revision/generation/time", async () => {
  const house = await mkdtemp(join(tmpdir(), "au-local-"));

  try {
    const initial = await run(plan(catalog, "runtime:git", house));

    assert.equal(initial.requirements[0].state, "missing");
    await run(get(catalog, "runtime:git", house));
    await assert.rejects(
      run(check(catalog, "runtime:git", house)),
      (e) => e.reason === "missing-binding"
    );
    await run(
      bind(house, "runtime:git", {
        adapter: "arbitrary-script",
        endpoint: { kind: "git", repository: house },
        account: null,
      })
    );
    await assert.rejects(
      run(check(catalog, "runtime:git", house)),
      (e) => e.reason === "unsupported-adapter"
    );
    await run(
      bind(house, "runtime:git", {
        adapter: "git",
        endpoint: { kind: "git", repository: house },
        account: null,
      })
    );
    const failed = await run(check(catalog, "runtime:git", house, 1000));
    assert.equal(failed[0].result, "failed");
    execFileSync("git", ["init", "--quiet", house]);
    const passed = await run(check(catalog, "runtime:git", house, 2000));
    assert.equal(passed[0].result, "passed");
    assert.match(passed[0].evidence.join("\n"), /version:git version/u);
    Schema.decodeUnknownSync(CheckOutput)(passed);
    Schema.decodeUnknownSync(PlanOutput)(
      await run(plan(catalog, "runtime:git", house, 2100))
    );
    Schema.decodeUnknownSync(StatusOutput)(
      await run(status(catalog, house, 2100))
    );
    const fresh = await run(status(catalog, house, 2100));
    const future = await run(status(catalog, house, 1999));
    const expired = await run(status(catalog, house, 302_001));

    const changed = await run(
      status({ ...catalog, generation: "changed" }, house, 2100)
    );

    assert.equal(fresh.ways[0].requirements[0].state, "passed");
    assert.equal(future.ways[0].requirements[0].state, "stale");
    assert.equal(expired.ways[0].requirements[0].state, "stale");
    assert.equal(changed.ways[0].requirements[0].state, "stale");
    await run(
      bind(house, "runtime:git", {
        adapter: "git",
        endpoint: { kind: "git", repository: house },
        account: null,
      })
    );
    const rebound = await run(status(catalog, house, 2100));

    assert.equal(rebound.ways[0].requirements[0].state, "unchecked");
    const db = new DatabaseSync(join(house, ".agenticu/capability.sqlite"));

    const saved = JSON.parse(
      db.prepare("SELECT value FROM capability").get().value
    );

    db.close();
    assert.deepEqual(saved.checks, [...failed, ...passed]);
    const metadata = await stat(join(house, ".agenticu/capability.sqlite"));

    // oxlint-disable-next-line eslint/no-bitwise -- Node mode includes file-type bits; masking is the exact permission-bit check.
    assert.equal(metadata.mode & 0o777, 0o600);
  } finally {
    await rm(house, { recursive: true, force: true });
  }
});

test("boundary admission and concurrent repeated selection survive a fresh reader", async () => {
  const house = await mkdtemp(join(tmpdir(), "au-resume-"));

  try {
    await assert.rejects(
      run(
        admitSelection({
          adapter: "git",
          endpoint: { kind: "git" },
          account: null,
        })
      ),
      (e) => e.reason === "invalid"
    );
    await Promise.all(
      Array.from({ length: 5 }, () => run(get(catalog, "runtime:git", house)))
    );
    const resumed = await run(status(catalog, house));

    assert.equal(resumed.ways.length, 1);
    const db = new DatabaseSync(join(house, ".agenticu/capability.sqlite"));
    db.prepare("UPDATE capability SET value=? WHERE id=1").run("{}");
    db.close();
    await assert.rejects(
      run(status(catalog, house)),
      (e) => e.reason === "invalid"
    );
  } finally {
    await rm(house, { recursive: true, force: true });
  }
});

test("relative Git binding stays in its selected house across a fresh process cwd", async () => {
  const root = await mkdtemp(join(tmpdir(), "au-endpoint-"));
  const house = join(root, "house-a");
  const other = join(root, "repository-b");

  try {
    execFileSync("git", ["init", "--quiet", house]);
    execFileSync("git", ["init", "--quiet", other]);
    await run(get(catalog, "runtime:git", house));

    const binding = await run(
      bind(house, "runtime:git", {
        adapter: "git",
        endpoint: { kind: "git", repository: "." },
        account: null,
      })
    );

    assert.equal(path.isAbsolute(binding.endpoint.repository), true);

    const bytes = execFileSync(
      process.execPath,
      [new URL("fixtures/check-from-cwd.mjs", import.meta.url).pathname, house],
      { cwd: other, encoding: "utf-8" }
    );

    const receipts = JSON.parse(bytes);

    assert.equal(receipts[0].result, "passed");
    assert.equal(
      receipts[0].evidence.includes(
        `repository:${binding.endpoint.repository}`
      ),
      true
    );
    assert.equal(
      receipts[0].evidence.includes(`root:${binding.endpoint.repository}`),
      true
    );
    assert.equal(
      receipts[0].evidence.some((item) => item.includes("repository-b")),
      false
    );

    const missing = await run(
      bind(house, "runtime:git", {
        adapter: "git",
        endpoint: { kind: "git", repository: "not-created" },
        account: null,
      })
    );

    assert.equal(missing.endpoint.repository, join(house, "not-created"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("grant is exact, independent from health, revocable and never poisoned by another grant", async () => {
  const house = await mkdtemp(join(tmpdir(), "au-authority-"));

  const account = {
    provider: "fictional",
    id: "fictional-workspace",
    alias: "test",
  };

  try {
    const binding = await run(
      bind(house, "runtime:git", {
        adapter: "git",
        endpoint: { kind: "git", repository: house },
        account,
      })
    );

    const request = {
      binding: binding.key,
      account,
      action: "publish",
      resource: "draft:one",
      budget: 1,
    };

    await assert.rejects(
      run(authorize(house, request, 10)),
      (e) => e.reason === "denied"
    );

    const grant = {
      id: "first",
      binding: binding.key,
      revision: binding.revision,
      account,
      action: "publish",
      resource: "draft:one",
      budget: 1,
      state: "active",
      given: 0,
      ends: 20,
      secretRef: "local-secret:fictional",
    };

    await run(giveGrant(house, grant));
    await run(giveGrant(house, { ...grant, id: "other" }));
    await run(revokeGrant(house, "other"));
    const authorized = await run(authorize(house, request, 10));

    assert.equal(authorized.id, "first");
    await assert.rejects(
      run(authorize(house, { ...request, resource: "draft:two" }, 10)),
      (e) => e.reason === "denied"
    );
    await assert.rejects(
      run(authorize(house, request, 20)),
      (e) => e.reason === "denied"
    );
    await run(revokeGrant(house, "first"));
    await assert.rejects(
      run(authorize(house, request, 10)),
      (e) => e.reason === "denied"
    );
  } finally {
    await rm(house, { recursive: true, force: true });
  }
});
