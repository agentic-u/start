import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const binary =
  process.env.AU_BIN ??
  fileURLToPath(new URL("../dist/main.js", import.meta.url));

const fixture =
  process.env.AU_CATALOG ??
  fileURLToPath(
    new URL("../../catalog/test/fixtures/catalog.json", import.meta.url)
  );

const source = JSON.parse(await readFile(fixture, "utf-8"));

const house = await mkdtemp(path.join(tmpdir(), "agenticu-cli-"));

const acceptance = {
  kind: "accepted",
  key: "denied-secret-key",
  way: "answer-with-a-receipt",
  version: "1",
  at: "2026-01-01T00:00:00Z",
  attempt: "attempt",
  checkKey: "check",
  principal: "private-principal",
  decision: "accepted",
  note: "private-note",
};

const names = [
  "find",
  "read",
  "needs",
  "ready",
  "plan",
  "get",
  "bind",
  "check",
  "status",
  "acquireBundle",
  "readBundle",
  "record",
  "accept",
  "resume",
  "job_start",
  "job_show",
  "job_input",
  "job_resume",
  "job_retry",
  "job_cancel",
  "job_decide",
  "job_continue",
  "execute",
];

const program =
  "const found=await tools.find({words:'browser'}); const read=await tools.read({id:'curriculum'}); return {count:found.found.length,title:read.document.title};";

const execute = (...args) =>
  spawnSync(
    process.execPath,
    [binary, "--catalog", fixture, "--house", house, ...args],
    {
      encoding: "utf-8",
      timeout: 15_000,
    }
  );

const json = (...args) => {
  const result = execute(...args);
  assert.equal(result.status, 0, result.stderr);

  return JSON.parse(result.stdout);
};

test("CLI discovers and reads actual generated public content", () => {
  const found = json("find");
  assert.equal(
    found.found.length + found.documents.length,
    source.data.documents.length
  );
  const document = source.data.documents.find((d) => d.kind === "runbook");
  assert.deepEqual(json("read", document.id), {
    generation: source.generation,
    document,
  });
  const failure = execute("read", "absent");
  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /not-found/u);
  assert.match(failure.stderr, /au find/u);
  assert.deepEqual(
    json("catalog").capabilities.map((operation) => operation.name),
    names
  );
  assert.equal(
    json("ready", source.data.workflows[0].id, "--have", "[]").basis,
    "claimed-ids-only"
  );
  const denied = execute("accept", "--command", JSON.stringify(acceptance));
  assert.notEqual(denied.status, 0);
  assert.equal(JSON.parse(denied.stderr)._tag, "ApprovalDenied");
  const executed = json("execute", program);
  assert.deepEqual(executed.toolCalls, ["find", "read"]);
  assert.equal(executed.result.title, "The curriculum");
});

test("HTTP projection has CLI parity and rejects invalid input", async (t) => {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const { port } = reservation.address();
  reservation.close();
  await once(reservation, "close");

  const child = spawn(
    process.execPath,
    [
      binary,
      "--catalog",
      fixture,
      "--house",
      house,
      "serve",
      "--port",
      String(port),
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  t.after(() => child.kill());
  let logs = "";
  child.stderr.on("data", (chunk) => {
    logs += chunk;
  });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- Each bounded startup probe depends on the previous actual server state.
      const response = await fetch(`${base}/openapi.json`);

      if (response.ok) {
        ready = true;
        break;
      }
    } catch (error) {
      if (error.cause?.code !== "ECONNREFUSED") {
        throw error;
      }
    }

    if (child.exitCode !== null) {
      break;
    }

    // oxlint-disable-next-line no-await-in-loop -- Only an observed refused connection is retried during the bounded server startup window.
    await delay(50);
  }

  assert.ok(ready, logs);

  await Promise.all(
    [
      ["find", { words: "browser" }, ["browser"]],
      ["read", { id: "curriculum" }, ["curriculum"]],
      [
        "needs",
        { id: source.data.workflows[0].id },
        [source.data.workflows[0].id],
      ],
      [
        "ready",
        { id: source.data.workflows[0].id, have: [] },
        [source.data.workflows[0].id, "--have", "[]"],
      ],
      ["execute", { code: program }, [program]],
    ].map(async ([operation, input, args]) => {
      const response = await fetch(`${base}/${operation}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), json(operation, ...args));
    })
  );

  const invalid = await fetch(`${base}/read`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: 3 }),
  });

  assert.equal(invalid.status, 400);

  const absent = await fetch(`${base}/read`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: "absent" }),
  });

  assert.equal(absent.status, 422);
  const absentBody = await absent.json();
  assert.equal(absentBody.reason, "not-found");

  const denied = await fetch(`${base}/accept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ command: acceptance }),
  });

  assert.equal(denied.status, 403);
  const deniedBody = await denied.json();
  assert.equal(deniedBody._tag, "ApprovalDenied");
});

test("MCP projection lists and executes the same checked operations", async (t) => {
  const child = spawn(
    process.execPath,
    [binary, "--catalog", fixture, "--house", house, "mcp"],
    {
      stdio: ["pipe", "pipe", "pipe"],
    }
  );

  t.after(() => child.kill());
  const pending = new Map();
  let buffer = "";
  let logs = "";
  child.stderr.on("data", (chunk) => {
    logs += chunk;
  });
  child.stdout.on("data", (chunk) => {
    buffer += chunk;

    for (;;) {
      const at = buffer.indexOf("\n");

      if (at === -1) {
        break;
      }

      const line = buffer.slice(0, at);
      buffer = buffer.slice(at + 1);

      if (!line.trim()) {
        continue;
      }

      const response = JSON.parse(line);
      const resolve = pending.get(response.id);

      if (resolve) {
        pending.delete(response.id);
        resolve(response);
      }
    }
  });
  let id = 0;

  const request = (method, params) => {
    const { promise, resolve, reject } = Promise.withResolvers();
    id += 1;
    const key = id;

    const timeout = setTimeout(() => {
      pending.delete(key);
      reject(new Error(`MCP ${method} timed out: ${logs}`));
    }, 10_000);

    pending.set(key, (response) => {
      clearTimeout(timeout);
      resolve(response);
    });
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: key, method, params })}\n`
    );

    return promise;
  };

  const initialized = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "agenticu-acceptance", version: "1" },
  });

  assert.ok(initialized.result, JSON.stringify(initialized));
  child.stdin.write(
    `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`
  );
  const listed = await request("tools/list", {});
  assert.deepEqual(
    listed.result.tools.map((tool) => tool.name).toSorted(),
    names.toSorted()
  );

  await Promise.all(
    [
      ["find", { words: "browser" }, ["browser"]],
      ["read", { id: "curriculum" }, ["curriculum"]],
      [
        "needs",
        { id: source.data.workflows[0].id },
        [source.data.workflows[0].id],
      ],
      [
        "ready",
        { id: source.data.workflows[0].id, have: [] },
        [source.data.workflows[0].id, "--have", "[]"],
      ],
      ["execute", { code: program }, [program]],
    ].map(async ([name, args, cliArgs]) => {
      const called = await request("tools/call", { name, arguments: args });
      assert.notEqual(called.result.isError, true, JSON.stringify(called));
      assert.deepEqual(
        JSON.parse(called.result.content[0].text),
        json(name, ...cliArgs)
      );
    })
  );

  const absent = await request("tools/call", {
    name: "read",
    arguments: { id: "absent" },
  });

  assert.equal(absent.result.isError, true);
  assert.match(JSON.stringify(absent.result), /No public way named absent/u);

  const denied = await request("tools/call", {
    name: "accept",
    arguments: { command: acceptance },
  });

  assert.equal(denied.result.isError, true);
  assert.match(JSON.stringify(denied.result), /Approval is required/u);
});

test("opted-in local Effect traces retain outcomes while excluding inputs and principal records", async () => {
  const destination = path.join(house, "operations.jsonl");

  for (const args of [
    ["read", "curriculum"],
    ["read", "absent"],
    ["accept", "--command", JSON.stringify(acceptance)],
  ]) {
    spawnSync(
      process.execPath,
      [binary, "--catalog", fixture, "--house", house, ...args],
      {
        encoding: "utf-8",
        timeout: 15_000,
        env: { ...process.env, AU_TRACE: destination },
      }
    );
  }

  const bytes = await readFile(destination, "utf-8");

  const spans = bytes
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  assert.deepEqual(
    spans.map((span) => [span.operation, span.outcome]),
    [
      ["read", "success"],
      ["read", "failure"],
      ["accept", "failure"],
    ]
  );
  assert.equal(spans[0].catalogGeneration, source.generation);
  assert.ok(spans.every((span) => span.revision === "@agentic-u/cli@0.1.0"));
  assert.doesNotMatch(
    bytes,
    /private-principal|private-note|denied-secret-key|originalInput|command|document|curriculum/u
  );
});

test("fresh CLI processes share only the selected house's private durable job state", () => {
  const started = json(
    "job_start",
    "cli-durable-job",
    "--key",
    "cli-job-start",
    "--attempt",
    "cli-attempt",
    "--way",
    "answer-with-a-receipt",
    "--version",
    "1",
    "--artifact",
    "review.md",
    "--at",
    "2026-01-01T00:00:00Z",
    "--standard",
    "null"
  );

  const reloaded = json("job_show", "cli-durable-job");

  assert.equal(started.status, "waiting_input");
  assert.deepEqual(reloaded, started);
  assert.equal(started.artifact, path.join(house, "review.md"));
  assert.equal(
    started.progress,
    path.join(house, ".agenticu", "progress.sqlite")
  );

  const cancelled = json(
    "job_cancel",
    "cli-durable-job",
    "--key",
    "cli-job-cancel",
    "--revision",
    String(started.revision)
  );

  assert.equal(cancelled.status, "cancelled");
  assert.equal(json("job_show", "cli-durable-job").status, "cancelled");
});
