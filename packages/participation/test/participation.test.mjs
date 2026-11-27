import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { record, resume } from "@agentic-u/progress";
import { it } from "@effect/vitest";
import { Effect, Result } from "effect";

import { client, openService, serve } from "../dist/index.js";

const jar = () => {
  let cookie = "";

  return async (url, init = {}) => {
    const headers = { ...init.headers, connection: "close" };

    if (cookie) {
      headers.cookie = cookie;
    }

    const response = await fetch(url, { ...init, headers });
    const cookies = response.headers.getSetCookie();

    if (cookies.length) {
      cookie = cookies.map((value) => value.split(";")[0]).join("; ");
    }

    return response;
  };
};

it.effect(
  "HTTP selection, independent devices, isolation, revocation, durable restart",
  () =>
    Effect.gen(function* participationJourney() {
      const dir = yield* Effect.promise(() =>
        mkdtemp(path.join(tmpdir(), "participation-"))
      );

      const baseURL = "http://127.0.0.1:19947";

      const options = {
        databasePath: path.join(dir, "shared.sqlite"),
        baseURL,
        secret: randomBytes(40).toString("hex"),
      };

      let service = yield* openService(options);

      let server = yield* serve(service, {
        port: 19_947,
        hostname: "127.0.0.1",
        baseURL,
      });

      const occupied = yield* serve(service, {
        port: 19_947,
        hostname: "127.0.0.1",
        baseURL,
      }).pipe(Effect.result);

      assert.ok(Result.isFailure(occupied));
      assert.equal(occupied.failure.reason, "transport");
      assert.equal(occupied.failure.cause.code, "EADDRINUSE");
      yield* Effect.addFinalizer(() =>
        Effect.promise(async () => {
          if (server.listening) {
            await promisify(server.close.bind(server))();
          }

          service.close();
          await rm(dir, { recursive: true });
        })
      );
      const first = jar();
      const second = jar();
      const other = jar();

      const auth = (fetcher, endpoint, body) =>
        Effect.promise(() =>
          fetcher(`${baseURL}/auth/${endpoint}`, {
            method: "POST",
            headers: { origin: baseURL, "content-type": "application/json" },
            body: JSON.stringify(body),
          })
        );

      const post = (records) =>
        Effect.promise(() =>
          first(`${baseURL}/participation/progress`, {
            method: "POST",
            headers: { origin: baseURL, "content-type": "application/json" },
            body: JSON.stringify({ records }),
          })
        );

      const password = randomBytes(24).toString("hex");

      const signup = yield* auth(first, "sign-up/email", {
        email: "alice@example.test",
        name: "Fictional Alice",
        password,
      });

      assert.equal(signup.status, 200);

      const signin = yield* auth(second, "sign-in/email", {
        email: "alice@example.test",
        password,
      });

      assert.equal(signin.status, 200);

      const bob = yield* auth(other, "sign-up/email", {
        email: "bob@example.test",
        name: "Fictional Bob",
        password,
      });

      assert.equal(bob.status, 200);
      const localPath = path.join(dir, "local.sqlite");

      const selected = {
        kind: "viewed",
        key: "selected",
        way: "fictional-way",
        version: "1",
        at: "2026-11-26T12:00:00Z",
      };

      yield* record(localPath, selected);
      yield* record(localPath, { ...selected, key: "private-local" });
      const a = client({ baseURL, fetch: first });
      const b = client({ baseURL, fetch: second });
      const c = client({ baseURL, fetch: other });
      const synced = yield* a.syncSelected(localPath, ["selected"]);
      assert.deepEqual(synced, [selected]);
      const secondHistory = yield* b.pull();
      assert.deepEqual(secondHistory, [selected]);
      const otherHistory = yield* c.pull();
      assert.deepEqual(otherHistory, []);

      const forged = yield* Effect.promise(() =>
        other(`${baseURL}/participation/progress?principal=alice`)
      );

      const forgedBody = yield* Effect.promise(() => forged.json());
      assert.deepEqual(forgedBody.records, []);

      const bobWrite = yield* Effect.promise(() =>
        other(`${baseURL}/participation/progress`, {
          method: "POST",
          headers: { origin: baseURL, "content-type": "application/json" },
          body: JSON.stringify({
            principal: "alice",
            records: [{ ...selected, way: "bob-only" }],
          }),
        })
      );

      assert.equal(bobWrite.status, 200);

      const anonymous = yield* Effect.promise(() =>
        fetch(`${baseURL}/participation/progress`)
      );

      assert.equal(anonymous.status, 401);

      const forbidden = yield* Effect.promise(() =>
        first(`${baseURL}/participation/progress`, {
          method: "POST",
          body: "{}",
        })
      );

      assert.equal(forbidden.status, 403);

      const malformed = yield* Effect.promise(() =>
        first(`${baseURL}/participation/progress`, {
          method: "POST",
          headers: { origin: baseURL, "content-type": "application/json" },
          body: "{",
        })
      );

      assert.equal(malformed.status, 400);

      const rollback = yield* post([
        { ...selected, key: "must-rollback" },
        { ...selected, way: "changed" },
      ]);

      assert.equal(rollback.status, 409);
      const intact = yield* b.pull();
      assert.deepEqual(intact, [selected]);
      yield* Effect.promise(() => promisify(server.close.bind(server))());
      service.close();
      service = yield* openService(options);
      server = yield* serve(service, {
        port: 19_947,
        hostname: "127.0.0.1",
        baseURL,
      });
      const restarted = yield* b.pull();
      assert.deepEqual(restarted, [selected]);
      const revoke = yield* auth(first, "revoke-sessions", {});
      assert.equal(revoke.status, 200);

      const revoked = yield* Effect.promise(() =>
        second(`${baseURL}/participation/progress`)
      );

      assert.equal(revoked.status, 401);
      const otherAfterRevoke = yield* c.pull();
      assert.deepEqual(otherAfterRevoke, [{ ...selected, way: "bob-only" }]);
      const localAfterRevoke = yield* resume(localPath);
      assert.equal(localAfterRevoke.length, 2);
    })
);

it.effect(
  "database open failure stays in the typed channel with its original cause",
  () =>
    Effect.gen(function* invalidDatabasePath() {
      const dir = yield* Effect.promise(() =>
        mkdtemp(path.join(tmpdir(), "participation-invalid-"))
      );

      yield* Effect.addFinalizer(() =>
        Effect.promise(() => rm(dir, { recursive: true }))
      );

      const result = yield* openService({
        databasePath: dir,
        baseURL: "http://127.0.0.1:4318",
        secret: randomBytes(40).toString("hex"),
      }).pipe(Effect.result);

      assert.ok(Result.isFailure(result));
      assert.equal(result.failure.reason, "storage");
      assert.ok(result.failure.cause instanceof Error);
    })
);
