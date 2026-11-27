// @effect-diagnostics-next-line nodeBuiltinImport:off -- Node host hashes exact artifact bytes.
import { createHash } from "node:crypto";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- This is the local filesystem host, not core review logic.
import { mkdirSync, readFileSync, statSync } from "node:fs";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- The SQLite host creates only the private database's parent directory.
import nodePath from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";

import type { ApprovalDenied } from "@agentic-u/operations/approval";
import * as Progress from "@agentic-u/progress";
import { Effect, Schema } from "effect";
import { createMachine, initialTransition, transition } from "xstate";

const Text = Schema.NonEmptyString;

const Count = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0)
);

export const Status = Schema.Literals([
  "waiting_input",
  "ready",
  "running",
  "review_ready",
  "waiting_approval",
  "completed",
  "rejected",
  "failed_retryable",
  "failed_terminal",
  "effect_unknown",
  "cancelled",
]);

export const Standard = Schema.Struct({
  sections: Schema.NonEmptyArray(Text),
  evidence: Schema.NonEmptyArray(Text),
});

export type ReviewStandard = typeof Standard.Type;

export const Review = Schema.Struct({
  digest: Text,
  bytes: Count,
  passed: Schema.Boolean,
  missing: Schema.Array(Text),
});

export const Job = Schema.Struct({
  schema: Schema.Literal(1),
  id: Text,
  revision: Count,
  status: Status,
  attempt: Text,
  way: Text,
  version: Text,
  artifact: Text,
  progress: Text,
  at: Text,
  standard: Schema.NullOr(Standard),
  review: Schema.NullOr(Review),
  decision: Schema.NullOr(
    Schema.Struct({
      principal: Text,
      decision: Schema.Literals(["accepted", "rejected"]),
      note: Text,
      digest: Text,
    })
  ),
  effect: Schema.NullOr(Progress.Command),
  cancelRequested: Schema.Boolean,
  failure: Schema.NullOr(Text),
  receipt: Schema.NullOr(Text),
});

export type ReviewJob = typeof Job.Type;

const common = { key: Text, id: Text, revision: Count };

export const Command = Schema.Union([
  Schema.Struct({
    key: Text,
    id: Text,
    kind: Schema.Literal("start"),
    attempt: Text,
    way: Text,
    version: Text,
    artifact: Text,
    progress: Text,
    at: Text,
    standard: Schema.NullOr(Standard),
  }),
  Schema.Struct({
    ...common,
    kind: Schema.Literal("provide_input"),
    standard: Standard,
  }),
  Schema.Struct({
    ...common,
    kind: Schema.Literals(["resume", "retry", "cancel"]),
  }),
  Schema.Struct({
    ...common,
    kind: Schema.Literal("decide"),
    principal: Text,
    decision: Schema.Literals(["accepted", "rejected"]),
    note: Text,
    digest: Text,
  }),
]);

export type JobCommand = typeof Command.Type;

export class JobError extends Schema.TaggedError<
  JobError,
  { readonly brand: unique symbol }
>()("JobError", {
  reason: Schema.Literals([
    "invalid",
    "storage",
    "conflict",
    "missing",
    "illegal",
    "corrupt",
  ]),
  message: Text,
  next: Text,
  cause: Schema.optionalKey(Schema.Unknown),
}) {}

const recovery: Readonly<Record<JobError["reason"], string>> = {
  invalid:
    "Use the operation input schema. A standard requires nonempty sections and evidence arrays of nonempty strings.",
  storage:
    "Inspect the storage cause and directory permissions; preserve existing bytes.",
  conflict:
    "Read job_show for the current revision. Use a new command key for changed input; start a new review if artifact bytes changed.",
  missing:
    "Use job_list to discover saved jobs, or job_start after recording a matching progress attempt.",
  illegal:
    "Read job_list for the legal next operations and job_show for the current revision.",
  corrupt:
    "Preserve the store and inspect the cause; do not overwrite or recreate corrupt records.",
};

const fail = (
  reason: JobError["reason"],
  message: string,
  next: string = recovery[reason]
): never => {
  throw new JobError({ reason, message, next });
};

const following: Readonly<Record<ReviewJob["status"], readonly string[]>> = {
  waiting_input: ["job_input", "job_cancel"],
  ready: ["job_resume", "job_cancel"],
  review_ready: ["job_resume", "job_cancel"],
  running: ["job_resume", "job_cancel"],
  waiting_approval: ["job_decide", "job_cancel"],
  effect_unknown: ["job_continue", "job_cancel"],
  failed_retryable: ["job_retry", "job_cancel"],
  completed: [],
  rejected: [],
  failed_terminal: [],
  cancelled: [],
};

const nextOperations = (job: ReviewJob): readonly string[] =>
  job.status === "running" && job.effect
    ? ["job_continue", "job_cancel"]
    : following[job.status];

export const JobListing = Schema.Struct({
  id: Text,
  revision: Count,
  status: Status,
  way: Text,
  attempt: Text,
  nextOperations: Schema.Array(Text),
});

const digest = (bytes: string | Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

const edges: readonly (readonly [string, Readonly<Record<string, string>>])[] =
  [
    ["waiting_input", { INPUT: "ready", CANCEL: "cancelled" }],
    ["ready", { RUN: "running", CANCEL: "cancelled" }],
    [
      "running",
      {
        REVIEW: "review_ready",
        DONE: "completed",
        REJECT: "rejected",
        UNKNOWN: "effect_unknown",
        FAIL: "failed_retryable",
      },
    ],
    ["review_ready", { WAIT: "waiting_approval", CANCEL: "cancelled" }],
    [
      "waiting_approval",
      { RUN: "running", CANCEL: "cancelled", FAIL: "failed_retryable" },
    ],
    ["effect_unknown", { RUN: "running" }],
    ["failed_retryable", { RETRY: "ready", CANCEL: "cancelled" }],
    ["completed", {}],
    ["rejected", {}],
    ["failed_terminal", {}],
    ["cancelled", {}],
  ];

const machine = createMachine({
  initial: "waiting_input",
  states: Object.fromEntries(
    edges.map(([name, events]) => [
      name,
      {
        on: Object.fromEntries(
          Object.entries(events).map(([event, target]) => [event, { target }])
        ),
      },
    ])
  ),
});

const move = (job: ReviewJob, event: string): ReviewJob => {
  const [initial] = initialTransition(machine);
  const snapshot = { ...initial, value: job.status };
  const [next] = transition(machine, snapshot, { type: event });

  if (next.value === job.status) {
    return fail(
      "illegal",
      `Cannot ${event} while ${job.status}.`,
      `Legal next operations: ${nextOperations(job).join(", ") || "none; this job is finished"}. Use the current revision from job_show.`
    );
  }

  return { ...job, status: Schema.decodeUnknownSync(Status)(next.value) };
};

const validateEffect = (job: ReviewJob): void => {
  const intent = job.effect;

  if (!intent) {
    return;
  }

  const { decision, review } = job;

  if (intent.kind !== "accepted" || !decision || !review) {
    return fail(
      "corrupt",
      "Persisted effect has no matching reviewed decision."
    );
  }

  const expected: Progress.LearningCommand = {
    kind: "accepted",
    key: `job:${job.id}:decision:${review.digest}`,
    way: job.way,
    version: job.version,
    at: job.at,
    attempt: job.attempt,
    checkKey: `job:${job.id}:check:${review.digest}`,
    principal: decision.principal,
    decision: decision.decision,
    note: decision.note,
  };

  if (
    !isDeepStrictEqual(intent, expected) ||
    decision.digest !== review.digest
  ) {
    fail(
      "corrupt",
      "Persisted effect does not match the exact reviewed decision."
    );
  }
};

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- SQLite bytes are admitted here before domain use.
const decodeJob = (body: unknown): ReviewJob => {
  try {
    const job = Schema.decodeUnknownSync(Schema.fromJsonString(Job))(body);

    if (
      (job.status === "review_ready" || job.status === "waiting_approval") &&
      !job.review
    ) {
      return fail("corrupt", "Reviewed state has no review result.");
    }

    if (job.status === "ready" && !job.standard) {
      return fail("corrupt", "Ready state has no standard.");
    }

    validateEffect(job);

    if (
      (job.status === "completed" ||
        job.status === "rejected" ||
        job.status === "effect_unknown") &&
      !job.effect
    ) {
      return fail("corrupt", "Decision state has no effect intent.");
    }

    return job;
  } catch (error) {
    throw new JobError({
      reason: "corrupt",
      message: "Unsupported or corrupt job state; existing bytes preserved.",
      next: recovery.corrupt,
      cause: error,
    });
  }
};

const tx = <A>(path: string, body: (db: DatabaseSync) => A): A => {
  const db = new DatabaseSync(path);

  try {
    db.exec(
      "PRAGMA busy_timeout=15000; PRAGMA synchronous=FULL; BEGIN IMMEDIATE;"
    );

    try {
      db.exec(
        "CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS commands(key TEXT PRIMARY KEY, request TEXT NOT NULL, reply TEXT NOT NULL)"
      );
      const value = body(db);
      db.exec("COMMIT");

      return value;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.close();
  }
};

const get = (db: DatabaseSync, id: string): ReviewJob => {
  const row = db.prepare("SELECT body FROM jobs WHERE id=?").get(id);

  return row ? decodeJob(row.body) : fail("missing", `No job ${id}.`);
};

const save = (db: DatabaseSync, job: ReviewJob): ReviewJob => {
  const next = { ...job, revision: job.revision + 1 };
  db.prepare(
    "INSERT INTO jobs(id,body) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body"
  ).run(job.id, JSON.stringify(next));

  return next;
};

const boundary = <A>(body: () => A): Effect.Effect<A, JobError> =>
  Effect.try({
    try: body,
    catch: (cause) =>
      Schema.is(JobError)(cause)
        ? cause
        : new JobError({
            reason: "storage",
            message:
              "Job storage or adapter failed; preserve state and inspect the cause.",
            next: recovery.storage,
            cause,
          }),
  });

export const admitCommand = (
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Public transport admission owns unknown command bytes.
  raw: unknown
): Effect.Effect<JobCommand, JobError> =>
  Schema.decodeUnknownEffect(Command)(raw).pipe(
    Effect.mapError(
      (cause) =>
        new JobError({
          reason: "invalid",
          message: "Invalid job command.",
          next: recovery.invalid,
          cause,
        })
    )
  );

const readStore = <A>(
  path: string,
  absent: () => A,
  read: (db: DatabaseSync) => A
): Effect.Effect<A, JobError> =>
  boundary(() => {
    if (statSync(path, { throwIfNoEntry: false }) === undefined) {
      return absent();
    }

    const db = new DatabaseSync(path, { readOnly: true });

    try {
      return read(db);
    } finally {
      db.close();
    }
  });

export const list = (path: string, includeFinished = false) =>
  readStore(
    path,
    () => [],
    (db) =>
      db
        .prepare("SELECT body FROM jobs ORDER BY id")
        .all()
        .map((row) => decodeJob(row.body))
        .filter((job) => includeFinished || nextOperations(job).length > 0)
        .map((job) => ({
          id: job.id,
          revision: job.revision,
          status: job.status,
          way: job.way,
          attempt: job.attempt,
          nextOperations: nextOperations(job),
        }))
  );

export const show = (
  path: string,
  id: string
): Effect.Effect<ReviewJob, JobError> =>
  readStore(
    path,
    () => fail("missing", `No job ${id}.`),
    (db) => get(db, id)
  );

const decide = (
  job: ReviewJob,
  input: Extract<JobCommand, { kind: "decide" }>
): ReviewJob => {
  if (job.status !== "waiting_approval" || !job.review) {
    return fail("illegal", "Job is not waiting for a principal decision.");
  }

  if (input.digest !== job.review.digest) {
    return fail("conflict", "Decision must bind the reviewed artifact digest.");
  }

  return {
    ...move(job, "RUN"),
    decision: {
      principal: input.principal,
      decision: input.decision,
      note: input.note,
      digest: input.digest,
    },
    effect: {
      kind: "accepted",
      key: `job:${job.id}:decision:${input.digest}`,
      way: job.way,
      version: job.version,
      at: job.at,
      attempt: job.attempt,
      checkKey: `job:${job.id}:check:${input.digest}`,
      principal: input.principal,
      decision: input.decision,
      note: input.note,
    },
  };
};

export const command = (
  databasePath: string,
  input: JobCommand,
  artifactDirectory: string = process.cwd()
): Effect.Effect<ReviewJob, JobError> =>
  boundary(() => {
    mkdirSync(nodePath.dirname(databasePath), { recursive: true });

    if (input.kind === "decide") {
      const db = new DatabaseSync(databasePath, { readOnly: true });
      let artifact: string | null = null;

      try {
        if (
          !db.prepare("SELECT key FROM commands WHERE key=?").get(input.key)
        ) {
          ({ artifact } = get(db, input.id));
        }
      } finally {
        db.close();
      }

      if (artifact && digest(readFileSync(artifact)) !== input.digest) {
        return fail(
          "conflict",
          "Artifact changed; start a new review of the current bytes."
        );
      }
    }

    return tx(databasePath, (db) => {
      const previous = db
        .prepare("SELECT request,reply FROM commands WHERE key=?")
        .get(input.key);

      if (previous) {
        if (!isDeepStrictEqual(JSON.parse(String(previous.request)), input)) {
          return fail(
            "conflict",
            "Command key already used with different content."
          );
        }

        return decodeJob(previous.reply);
      }

      let job: ReviewJob;

      if (input.kind === "start") {
        if (db.prepare("SELECT id FROM jobs WHERE id=?").get(input.id)) {
          return fail("conflict", "Job already exists.");
        }

        job = {
          schema: 1,
          id: input.id,
          revision: 0,
          status: input.standard ? "ready" : "waiting_input",
          attempt: input.attempt,
          way: input.way,
          version: input.version,
          artifact: nodePath.resolve(artifactDirectory, input.artifact),
          progress: nodePath.resolve(input.progress),
          at: input.at,
          standard: input.standard,
          review: null,
          decision: null,
          effect: null,
          cancelRequested: false,
          failure: input.standard
            ? null
            : "Supply explicit required sections and evidence strings.",
          receipt: null,
        };
      } else {
        job = get(db, input.id);

        if (job.revision !== input.revision) {
          return fail(
            "conflict",
            "Job revision changed; show current state before issuing a new command."
          );
        }

        if (input.kind === "provide_input") {
          job = {
            ...move(job, "INPUT"),
            standard: input.standard,
            failure: null,
          };
        } else if (input.kind === "cancel") {
          job =
            job.status === "running" || job.status === "effect_unknown"
              ? { ...job, cancelRequested: true }
              : move(job, "CANCEL");
        } else if (input.kind === "retry") {
          job = {
            ...move(job, "RETRY"),
            failure: null,
            review: null,
            decision: null,
            effect: null,
          };
        } else if (input.kind === "decide") {
          job = decide(job, input);
        } else if (job.status === "review_ready") {
          job = move(job, "WAIT");
        } else if (job.status === "ready" || job.status === "effect_unknown") {
          job = move(job, "RUN");
        } else if (
          !["running", "completed", "rejected", "cancelled"].includes(
            job.status
          )
        ) {
          return fail(
            "illegal",
            `Cannot resume ${job.status}.`,
            job.status === "waiting_input"
              ? 'Call job_input with this id, current revision, a new key and standard: {sections: ["Required heading"], evidence: ["Required evidence string"]}; then job_resume.'
              : `Use ${nextOperations(job).join(" or ") || "a new job_start; this job is finished"} with the current revision.`
          );
        }
      }

      const result = save(db, job);
      db.prepare("INSERT INTO commands(key,request,reply) VALUES (?,?,?)").run(
        input.key,
        JSON.stringify(input),
        JSON.stringify(result)
      );

      return result;
    });
  });

export interface HostOptions<Requirements = never> {
  readonly authorizeDecision: (
    job: ReviewJob
  ) => Effect.Effect<void, ApprovalDenied, Requirements>;
  readonly afterDecisionDispatch?: () => void;
}

const reviewArtifact = (claimed: ReviewJob) =>
  Effect.gen(function* executeReview() {
    const { standard } = claimed;

    if (!standard) {
      return yield* Effect.fail(
        new JobError({
          reason: "corrupt",
          message: "Running review has no standard.",
          next: recovery.corrupt,
        })
      );
    }

    const result = yield* boundary(() => {
      const bytes = readFileSync(claimed.artifact);
      const content = bytes.toString("utf-8");
      const hash = digest(bytes);

      const headings = new Set(
        content
          .split(/\r?\n/u)
          .filter((line) => /^#{1,6}\s+/u.test(line))
          .map((line) => line.replace(/^#{1,6}\s+/u, "").trim())
      );

      const missing = [
        ...standard.sections.flatMap((section) =>
          headings.has(section) ? [] : [`section:${section}`]
        ),
        ...standard.evidence.flatMap((evidence) =>
          content.includes(evidence) ? [] : [`evidence:${evidence}`]
        ),
      ];

      return { hash, missing, bytes: bytes.length };
    });

    const artifactKey = `job:${claimed.id}:artifact:${result.hash}`;
    const checkKey = `job:${claimed.id}:check:${result.hash}`;

    yield* Progress.record(claimed.progress, {
      kind: "artifact",
      key: artifactKey,
      way: claimed.way,
      version: claimed.version,
      at: claimed.at,
      attempt: claimed.attempt,
      artifact: `sha256:${result.hash}`,
      interpretation: {
        adapter: "literal-markdown-review-v1",
        path: claimed.artifact,
        standard,
      },
    });
    yield* Progress.record(claimed.progress, {
      kind: "checked",
      key: checkKey,
      way: claimed.way,
      version: claimed.version,
      at: claimed.at,
      attempt: claimed.attempt,
      artifactKey,
      result: result.missing.length ? "failed" : "passed",
      evidence: [
        `sha256:${result.hash};bytes:${result.bytes}`,
        JSON.stringify({ standard, missing: result.missing }),
      ],
      checkedBy: "literal-markdown-review-v1",
    });

    return {
      ...move(claimed, "REVIEW"),
      review: {
        digest: result.hash,
        bytes: result.bytes,
        passed: result.missing.length === 0,
        missing: result.missing,
      },
      failure: null,
    };
  });

const dispatchDecision = <Requirements>(
  claimed: ReviewJob,
  options: HostOptions<Requirements>
) =>
  Effect.gen(function* executeDecision() {
    const intent = claimed.effect;
    const { decision } = claimed;

    if (!intent || !decision) {
      return yield* Effect.fail(
        new JobError({
          reason: "corrupt",
          message: "Decision dispatch has no admitted intent.",
          next: recovery.corrupt,
        })
      );
    }

    const history = yield* Progress.resume(claimed.progress);
    const existing = history.find((row) => row.key === intent.key);

    if (existing && !isDeepStrictEqual(existing, intent)) {
      return yield* Effect.fail(
        new JobError({
          reason: "conflict",
          message: "Progress effect key has different content.",
          next: recovery.conflict,
        })
      );
    }

    if (!existing) {
      yield* boundary(() => {
        if (digest(readFileSync(claimed.artifact)) !== decision.digest) {
          fail(
            "conflict",
            "Artifact changed after decision; reconciliation required."
          );
        }
      });
      yield* options.authorizeDecision(claimed);
      yield* boundary(() => {
        if (digest(readFileSync(claimed.artifact)) !== decision.digest) {
          fail(
            "conflict",
            "Artifact changed while awaiting authority; reconciliation required."
          );
        }
      });
      yield* Progress.record(claimed.progress, intent);
    }

    if (options.afterDecisionDispatch) {
      yield* Effect.sync(options.afterDecisionDispatch);
    }

    return {
      ...move(claimed, decision.decision === "accepted" ? "DONE" : "REJECT"),
      receipt: intent.key,
      failure: null,
    };
  });

export const run = <Requirements>(
  path: string,
  id: string,
  options: HostOptions<Requirements>
): Effect.Effect<ReviewJob, JobError | ApprovalDenied, Requirements> =>
  Effect.gen(function* executeJob() {
    const claimed = yield* show(path, id);

    if (claimed.status !== "running") {
      return claimed;
    }

    let outcome: ReviewJob;

    if (claimed.effect) {
      outcome = yield* dispatchDecision(claimed, options).pipe(
        Effect.catchTags({
          JobError: (error) =>
            Effect.succeed({
              ...move(claimed, "UNKNOWN"),
              failure: `Decision effect requires readback: ${error.message}`,
            }),
          ProgressError: (error) =>
            Effect.succeed({
              ...move(claimed, "UNKNOWN"),
              failure: `Decision effect requires readback: ${error.message}`,
            }),
        })
      );
    } else if (claimed.cancelRequested) {
      outcome = { ...claimed, status: "cancelled" };
    } else {
      outcome = yield* reviewArtifact(claimed).pipe(
        Effect.catchTags({
          JobError: (error) =>
            Effect.succeed({
              ...move(claimed, "FAIL"),
              failure: `Review could not finish: ${error.message}`,
            }),
          ProgressError: (error) =>
            Effect.succeed({
              ...move(claimed, "FAIL"),
              failure: `Review could not finish: ${error.message}`,
            }),
        })
      );
    }

    return yield* boundary(() =>
      tx(path, (db) => {
        const current = get(db, id);

        if (
          current.status !== "running" ||
          current.effect?.key !== claimed.effect?.key
        ) {
          return current;
        }

        return save(db, {
          ...outcome,
          status:
            !claimed.effect && current.cancelRequested
              ? "cancelled"
              : outcome.status,
          revision: current.revision,
          cancelRequested: current.cancelRequested,
        });
      })
    );
  });
