import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";

import { Approval, ApprovalDenied } from "@agentic-u/operations";
import * as Progress from "@agentic-u/progress";
import { it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { command, Job, list, show } from "../src/index.js";
import type { JobCommand } from "../src/index.js";
import {
  jobOperations,
  jobListOperation,
  JobsStorage,
} from "../src/operations.js";

const exec = promisify(execFile);

const standard = {
  sections: ["Finding", "Evidence"],
  evidence: ["invoice-42"],
} as const;

const at = "2026-11-26T12:00:00Z";

const child = (
  database: string,
  action: string,
  payload: string,
  cwd: string = process.cwd()
) =>
  Effect.promise(() =>
    exec(
      process.execPath,
      [
        new URL("process.mjs", import.meta.url).pathname,
        database,
        action,
        payload,
      ],
      { cwd }
    )
  ).pipe(
    Effect.flatMap((result) =>
      Schema.decodeUnknownEffect(Schema.fromJsonString(Job))(
        result.stdout.trim()
      )
    )
  );

const send = (database: string, input: JobCommand) => command(database, input);

it.effect(
  "relative artifact admission survives a different fresh-process cwd and key replay",
  () =>
    Effect.gen(function* qualifyArtifactOwnership() {
      const { database, start } = yield* setup;
      const house = path.dirname(database);
      const other = path.join(house, "other-cwd");

      yield* Effect.promise(() => mkdir(other));
      yield* Effect.promise(() =>
        writeFile(path.join(other, "draft.md"), "wrong file without evidence")
      );

      const request = { ...start, artifact: "draft.md", standard };

      let job = yield* child(
        database,
        "command",
        JSON.stringify(request),
        house
      );

      assert.equal(
        job.artifact,
        yield* Effect.promise(() => realpath(path.join(house, "draft.md")))
      );
      assert.deepEqual(
        yield* child(database, "command", JSON.stringify(request), other),
        job
      );
      job = yield* child(
        database,
        "command",
        JSON.stringify({
          kind: "resume",
          key: "resume",
          id: job.id,
          revision: job.revision,
        }),
        other
      );
      job = yield* child(database, "run", job.id, other);
      assert.equal(job.review?.passed, true);
    }).pipe(Effect.scoped)
);

it.effect(
  "safe retry preserves failed predicates and cancellation before claim prevents review",
  () =>
    Effect.gen(function* qualifySafeReviewRetry() {
      const { database, artifact, progress, start } = yield* setup;

      let job = yield* send(database, {
        ...start,
        artifact: `${artifact}.missing`,
        standard,
      });

      job = yield* send(database, {
        kind: "resume",
        key: "review",
        id: job.id,
        revision: job.revision,
      });
      job = yield* child(database, "run", job.id);
      assert.equal(job.status, "failed_retryable");
      yield* Effect.promise(() =>
        writeFile(`${artifact}.missing`, "# Finding\nno evidence")
      );
      job = yield* send(database, {
        kind: "retry",
        key: "retry",
        id: job.id,
        revision: job.revision,
      });
      job = yield* send(database, {
        kind: "resume",
        key: "retry-run",
        id: job.id,
        revision: job.revision,
      });
      job = yield* child(database, "run", job.id);
      assert.equal(job.review?.passed, false);
      assert.deepEqual(job.review?.missing, [
        "section:Evidence",
        "evidence:invoice-42",
      ]);
      job = yield* send(database, {
        ...start,
        key: "cancel-start",
        id: "cancelled",
        standard,
      });
      job = yield* send(database, {
        kind: "cancel",
        key: "cancel",
        id: job.id,
        revision: job.revision,
      });
      assert.equal((yield* child(database, "run", job.id)).status, "cancelled");
      assert.equal((yield* Progress.resume(progress)).length, 3);
    }).pipe(Effect.scoped)
);

const setup = Effect.gen(function* setup() {
  const directory = yield* Effect.acquireRelease(
    Effect.promise(() => mkdtemp(path.join(tmpdir(), "au-jobs-"))),
    (value) => Effect.promise(() => rm(value, { recursive: true, force: true }))
  );

  const database = path.join(directory, "jobs.sqlite");
  const progress = path.join(directory, "progress.sqlite");
  const artifact = path.join(directory, "draft.md");

  yield* Effect.promise(() =>
    writeFile(
      artifact,
      "# Finding\nfictional finding\n# Evidence\ninvoice-42\n"
    )
  );
  yield* Progress.record(progress, {
    kind: "started",
    key: "attempt-start",
    attempt: "attempt",
    way: "review",
    version: "v1",
    at,
    originalInput: { fictional: true },
  });

  return {
    database,
    progress,
    artifact,
    start: {
      kind: "start",
      key: "start",
      id: "job",
      attempt: "attempt",
      way: "review",
      version: "v1",
      at,
      progress,
      artifact,
      standard: null,
    } as const,
  };
});

const ready = (
  database: string,
  start: Extract<JobCommand, { kind: "start" }>
) =>
  Effect.gen(function* awaitReview() {
    let job = yield* send(database, { ...start, standard });

    job = yield* send(database, {
      kind: "resume",
      key: `review:${job.id}`,
      id: job.id,
      revision: job.revision,
    });
    job = yield* child(database, "run", job.id);
    assert.equal(job.status, "review_ready");
    assert.equal(job.review?.passed, true);

    return yield* send(database, {
      kind: "resume",
      key: `wait:${job.id}`,
      id: job.id,
      revision: job.revision,
    });
  });

it.effect(
  "fresh stores are discoverable without creating a database and missing jobs have recovery",
  () =>
    Effect.gen(function* qualifyFreshDiscovery() {
      const { database } = yield* setup;
      assert.deepEqual(yield* list(database), []);
      const missing = yield* Effect.flip(show(database, "absent"));
      assert.equal(missing.reason, "missing");
      assert.match(missing.next, /job_list/u);
      yield* Effect.promise(() =>
        assert.rejects(readFile(database), { code: "ENOENT" })
      );
    }).pipe(Effect.scoped)
);

it.effect(
  "job discovery returns legal next operations and completed work only on request",
  () =>
    Effect.gen(function* qualifyJobDiscovery() {
      const { database, start } = yield* setup;
      let job = yield* send(database, start);
      const waiting = yield* list(database);
      assert.deepEqual(
        waiting.map((row) => [
          row.id,
          row.revision,
          row.status,
          row.nextOperations,
        ]),
        [[job.id, job.revision, "waiting_input", ["job_input", "job_cancel"]]]
      );

      const error = yield* Effect.flip(
        send(database, {
          kind: "resume",
          key: "bad-resume",
          id: job.id,
          revision: job.revision,
        })
      );

      assert.equal(error.reason, "illegal");
      assert.match(error.next, /job_input.*sections.*evidence/u);
      assert.deepEqual(yield* show(database, job.id), job);
      job = yield* send(database, {
        kind: "cancel",
        key: "cancel",
        id: job.id,
        revision: job.revision,
      });
      assert.deepEqual(yield* list(database), []);
      assert.equal((yield* list(database, true))[0].status, "cancelled");
      assert.deepEqual((yield* list(database, true))[0].nextOperations, []);
    }).pipe(Effect.scoped)
);

it.effect(
  "job_start rejects absent or mismatched progress attempts before saving and job_list exposes valid starts",
  () =>
    Effect.gen(function* qualifyStartAdmission() {
      const { database, progress, start } = yield* setup;

      const environment = {
        databasePath: database,
        progressPath: progress,
        houseDirectory: path.dirname(database),
      };

      const { kind: _kind, progress: _progress, ...input } = start;

      for (const changed of [
        { attempt: "absent" },
        { way: "other" },
        { version: "v2" },
      ]) {
        const failure = yield* Effect.flip(
          jobOperations[0]
            .handler({ ...input, ...changed })
            .pipe(Effect.provideService(JobsStorage, environment))
        );

        assert.equal(failure.reason, "missing");
        assert.match(failure.next, /record.*started/u);
      }

      assert.deepEqual(yield* list(database), []);
      yield* jobOperations[0]
        .handler(input)
        .pipe(Effect.provideService(JobsStorage, environment));

      const jobs = yield* jobListOperation
        .handler({})
        .pipe(Effect.provideService(JobsStorage, environment));

      assert.equal(jobs[0].id, start.id);
      assert.deepEqual(jobs[0].nextOperations, ["job_input", "job_cancel"]);
    }).pipe(Effect.scoped)
);

it.effect(
  "fresh process review and SIGKILL decision readback never duplicate progress",
  () =>
    Effect.gen(function* qualifyCrashReadback() {
      const { database, progress, start } = yield* setup;
      let job = yield* send(database, start);

      assert.equal(job.status, "waiting_input");
      assert.deepEqual(yield* send(database, start), job);
      assert.equal(
        (yield* Effect.flip(send(database, { ...start, artifact: "changed" })))
          .reason,
        "conflict"
      );
      job = yield* child(
        database,
        "command",
        JSON.stringify({
          kind: "provide_input",
          key: "input",
          id: job.id,
          revision: job.revision,
          standard,
        })
      );
      job = yield* child(
        database,
        "command",
        JSON.stringify({
          kind: "resume",
          key: "review",
          id: job.id,
          revision: job.revision,
        })
      );
      job = yield* child(database, "run", job.id);
      assert.equal(job.review?.passed, true);
      job = yield* child(
        database,
        "command",
        JSON.stringify({
          kind: "resume",
          key: "wait",
          id: job.id,
          revision: job.revision,
        })
      );
      assert.ok(job.review);

      const decision = {
        kind: "decide",
        key: "approve",
        id: job.id,
        revision: job.revision,
        principal: "fictional principal",
        decision: "accepted",
        note: "synthetic test decision only",
        digest: job.review.digest,
      } as const;

      yield* Effect.promise(() =>
        assert.rejects(
          exec(process.execPath, [
            new URL("process.mjs", import.meta.url).pathname,
            database,
            "operation-crash",
            JSON.stringify({ input: decision, progress }),
          ]),
          { signal: "SIGKILL" }
        )
      );
      job = yield* child(database, "show", job.id);
      assert.equal(job.status, "running");
      job = yield* child(
        database,
        "operation-continue",
        JSON.stringify({
          input: { key: "continue", id: job.id, revision: job.revision },
          progress,
        })
      );
      assert.equal(job.status, "completed");
      yield* Effect.all(
        Array.from({ length: 3 }, () => child(database, "run", job.id)),
        { concurrency: "unbounded" }
      );

      const history = yield* Progress.resume(progress);

      assert.equal(history.filter((row) => row.kind === "accepted").length, 1);
      assert.equal(history.length, 4);
      assert.equal((yield* send(database, decision)).status, "running");
      assert.equal(
        (yield* child(database, "show", job.id)).status,
        "completed"
      );
    }).pipe(Effect.scoped)
);

it.effect(
  "revision races, changed bytes, unknown effect and corrupt state stay explicit",
  () =>
    Effect.gen(function* qualifyStateBoundaries() {
      const { database, artifact, progress, start } = yield* setup;
      let job = yield* ready(database, start);

      const cancel = {
        kind: "cancel",
        key: "cancel",
        id: job.id,
        revision: job.revision,
      };

      const outcomes = yield* Effect.promise(() =>
        Promise.allSettled([
          exec(process.execPath, [
            new URL("process.mjs", import.meta.url).pathname,
            database,
            "command",
            JSON.stringify(cancel),
          ]),
          exec(process.execPath, [
            new URL("process.mjs", import.meta.url).pathname,
            database,
            "command",
            JSON.stringify({ ...cancel, key: "other" }),
          ]),
        ])
      );

      assert.equal(
        outcomes.filter((outcome) => outcome.status === "fulfilled").length,
        1
      );
      assert.equal((yield* child(database, "run", job.id)).status, "cancelled");
      job = yield* ready(database, { ...start, id: "job2", key: "job2" });
      yield* Effect.promise(() => writeFile(artifact, "changed"));
      assert.ok(job.review);
      assert.equal(
        (yield* Effect.flip(
          send(database, {
            kind: "decide",
            key: "changed",
            id: job.id,
            revision: job.revision,
            principal: "p",
            decision: "accepted",
            note: "n",
            digest: job.review.digest,
          })
        )).reason,
        "conflict"
      );
      yield* Effect.promise(() =>
        writeFile(
          artifact,
          "# Finding\nfictional finding\n# Evidence\ninvoice-42\n"
        )
      );
      job = yield* send(database, {
        kind: "decide",
        key: "approve",
        id: job.id,
        revision: job.revision,
        principal: "p",
        decision: "accepted",
        note: "n",
        digest: job.review.digest,
      });

      const original = yield* Effect.promise(() => readFile(progress));

      yield* Effect.promise(() => writeFile(progress, "broken"));
      job = yield* child(database, "run", job.id);
      assert.equal(job.status, "effect_unknown");
      assert.equal(
        yield* Effect.promise(() => readFile(progress, "utf-8")),
        "broken"
      );
      yield* Effect.promise(() => writeFile(progress, original));
      job = yield* send(database, {
        kind: "resume",
        key: "reconcile",
        id: job.id,
        revision: job.revision,
      });
      job = yield* child(database, "run", job.id);
      assert.equal(job.status, "completed");
      yield* Effect.sync(() => {
        const db = new DatabaseSync(database);
        db.prepare("UPDATE jobs SET body=? WHERE id=?").run("{broken", "job2");
        db.close();
      });

      const bytes = yield* Effect.promise(() => readFile(database));

      assert.equal(
        (yield* Effect.flip(show(database, "job2"))).reason,
        "corrupt"
      );
      assert.deepEqual(yield* Effect.promise(() => readFile(database)), bytes);
    }).pipe(Effect.scoped)
);

it.effect(
  "supported operations default-deny decisions and recheck authority at dispatch",
  () =>
    Effect.gen(function* qualifyFreshAuthority() {
      const { database, progress, start } = yield* setup;
      let job = yield* ready(database, start);

      assert.ok(job.review);

      const decision = {
        key: "decision",
        id: job.id,
        revision: job.revision,
        principal: "fictional",
        decision: "rejected",
        note: "synthetic rejection",
        digest: job.review.digest,
      } as const;

      const gate = jobOperations.at(6);

      assert.ok(gate);

      const environment = {
        databasePath: database,
        progressPath: progress,
        houseDirectory: path.dirname(database),
      };

      const denied = yield* Effect.flip(
        gate
          .handler(decision)
          .pipe(
            Effect.provideService(JobsStorage, environment),
            Effect.provide(Approval.denyAll)
          )
      );

      assert.equal(denied._tag, "ApprovalDenied");

      const checks: string[] = [];

      job = yield* gate.handler(decision).pipe(
        Effect.provideService(JobsStorage, environment),
        Effect.provideService(Approval, {
          approve: (name) => {
            checks.push(name);

            return name === "job_decision_dispatch"
              ? Effect.fail(
                  new ApprovalDenied({
                    capabilityName: name,
                    reason: "revoked",
                  })
                )
              : Effect.void;
          },
        }),
        Effect.catchTag("ApprovalDenied", () => show(database, job.id))
      );
      assert.deepEqual(checks, ["job_decide", "job_decision_dispatch"]);
      assert.equal(job.status, "running");
      assert.equal(
        (yield* Progress.resume(progress)).filter(
          (row) => row.kind === "accepted"
        ).length,
        0
      );
      job = yield* jobOperations[7]
        .handler({ key: "continue", id: job.id, revision: job.revision })
        .pipe(
          Effect.provideService(JobsStorage, environment),
          Effect.provide(Approval.allowAll)
        );
      assert.equal(job.status, "rejected");
      assert.equal(
        (yield* Progress.resume(progress)).filter(
          (row) => row.kind === "accepted"
        ).length,
        1
      );
    }).pipe(Effect.scoped)
);
