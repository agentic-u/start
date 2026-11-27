import {
  Approval,
  ApprovalDenied,
  defineContract,
  implement,
} from "@agentic-u/operations";
import * as Progress from "@agentic-u/progress";
import { Context, Effect, Schema } from "effect";

import {
  Job,
  JobError,
  JobListing,
  Standard,
  command,
  list,
  run,
  show,
} from "./index.js";

export class JobsStorage extends Context.Service<
  JobsStorage,
  {
    readonly databasePath: string;
    readonly progressPath: string;
    readonly houseDirectory: string;
    readonly afterDecisionDispatch?: () => void;
  }
>()("@agentic-u/jobs/JobsStorage") {}

const Text = Schema.NonEmptyString;

const Revision = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0)
);

const identified = { key: Text, id: Text, revision: Revision };

const jobStart = defineContract("job_start", {
  description:
    "Start a private durable review of an artifact in an existing progress attempt. Null standard asks for missing input.",
  input: Schema.Struct({
    key: Text,
    id: Text,
    attempt: Text,
    way: Text,
    version: Text,
    artifact: Text,
    at: Text,
    standard: Schema.NullOr(Standard),
  }),
  output: Job,
  failure: JobError,
  annotations: { idempotent: true },
});

const jobShow = defineContract("job_show", {
  description:
    "Read a saved private job without running or approving anything.",
  input: Schema.Struct({ id: Text }),
  output: Job,
  failure: JobError,
  annotations: { readOnly: true, idempotent: true },
});

const jobList = defineContract("job_list", {
  description:
    "Discover private active jobs, their current revisions and legal next operations without running anything. Set includeFinished to include completed, rejected or cancelled jobs. Decision and continuation still require current approval.",
  input: Schema.Struct({ includeFinished: Schema.optionalKey(Schema.Boolean) }),
  output: Schema.Array(JobListing),
  failure: JobError,
  annotations: { readOnly: true, idempotent: true },
});

const jobInput = defineContract("job_input", {
  description:
    "Supply a standard with nonempty sections (required Markdown heading text) and evidence (required exact strings) arrays for a waiting review. Use the current job revision and a new command key.",
  input: Schema.Struct({ ...identified, standard: Standard }),
  output: Job,
  failure: JobError,
  annotations: { idempotent: true },
});

const jobResume = defineContract("job_resume", {
  description:
    "Resume artifact review or enter the approval wait. A pending decision requires gated job_continue.",
  input: Schema.Struct(identified),
  output: Job,
  failure: JobError,
  annotations: { idempotent: true },
});

const jobRetry = defineContract("job_retry", {
  description:
    "Retry a known-safe failed review step. This does not dispatch a decision.",
  input: Schema.Struct(identified),
  output: Job,
  failure: JobError,
  annotations: { idempotent: true },
});

const jobCancel = defineContract("job_cancel", {
  description:
    "Cancel future work; already claimed effects must still be reconciled and are never reversed.",
  input: Schema.Struct(identified),
  output: Job,
  failure: JobError,
  annotations: { idempotent: true },
});

const jobDecide = defineContract("job_decide", {
  description:
    "Record an explicitly approved principal decision on the exact reviewed digest. Requires current Approval at entry and dispatch.",
  input: Schema.Struct({
    ...identified,
    principal: Text,
    decision: Schema.Literals(["accepted", "rejected"]),
    note: Text,
    digest: Text,
  }),
  output: Job,
  failure: Schema.Union([JobError, ApprovalDenied]),
  needsApproval: true,
  annotations: { idempotent: true },
});

const jobContinue = defineContract("job_continue", {
  description:
    "Reconcile a pending decision, requiring fresh Approval before any absent receipt is dispatched.",
  input: Schema.Struct(identified),
  output: Job,
  failure: Schema.Union([JobError, ApprovalDenied]),
  needsApproval: true,
  annotations: { idempotent: true },
});

const dispatchApproved = (path: string, id: string) =>
  Effect.gen(function* dispatchWithCurrentApproval() {
    const approval = yield* Approval;
    const storage = yield* JobsStorage;

    return yield* run(path, id, {
      authorizeDecision: (job) =>
        approval.approve("job_decision_dispatch", job),
      afterDecisionDispatch: () => storage.afterDecisionDispatch?.(),
    });
  });

export const jobListOperation = implement(jobList, (input) =>
  Effect.gen(function* listJobs() {
    const storage = yield* JobsStorage;

    return yield* list(storage.databasePath, input.includeFinished);
  })
);

export const jobOperations = [
  implement(jobStart, (input) =>
    Effect.gen(function* startJob() {
      const storage = yield* JobsStorage;

      const history = yield* Progress.resume(storage.progressPath).pipe(
        Effect.mapError(
          (cause) =>
            new JobError({
              reason: "storage",
              message: "Could not read the progress attempt for job_start.",
              next: "Inspect the progress store cause; preserve existing records.",
              cause,
            })
        )
      );

      if (
        !history.some(
          (row) =>
            row.kind === "started" &&
            row.attempt === input.attempt &&
            row.way === input.way &&
            row.version === input.version
        )
      ) {
        return yield* new JobError({
          reason: "missing",
          message:
            "No started progress attempt matches this attempt, way and version.",
          next: "Use record with kind started for this exact attempt, way and version, or select a matching started attempt from resume; then job_start.",
        });
      }

      return yield* command(
        storage.databasePath,
        {
          ...input,
          kind: "start",
          progress: storage.progressPath,
        },
        storage.houseDirectory
      );
    })
  ),
  implement(jobShow, (input) =>
    Effect.gen(function* showJob() {
      const storage = yield* JobsStorage;

      return yield* show(storage.databasePath, input.id);
    })
  ),
  implement(jobInput, (input) =>
    Effect.gen(function* inputJob() {
      const storage = yield* JobsStorage;

      return yield* command(storage.databasePath, {
        ...input,
        kind: "provide_input",
      });
    })
  ),
  implement(jobResume, (input) =>
    Effect.gen(function* resumeJob() {
      const storage = yield* JobsStorage;
      const current = yield* show(storage.databasePath, input.id);

      if (current.effect) {
        return yield* Effect.fail(
          new JobError({
            reason: "illegal",
            message:
              "A decision is pending or complete; use approved job_continue to reconcile it.",
            next: "Use job_continue with current approval, this id, the current revision and a new command key.",
          })
        );
      }

      const accepted = yield* command(storage.databasePath, {
        ...input,
        kind: "resume",
      });

      if (accepted.status !== "running") {
        return accepted;
      }

      return yield* run(storage.databasePath, input.id, {
        authorizeDecision: () =>
          Effect.fail(
            new ApprovalDenied({
              capabilityName: "job_resume",
              reason: "Decision dispatch is forbidden through job_resume.",
            })
          ),
      }).pipe(
        Effect.catchTag("ApprovalDenied", (cause) =>
          Effect.fail(
            new JobError({
              reason: "illegal",
              message: cause.reason,
              next: "Use job_continue with current approval to reconcile the pending decision.",
              cause,
            })
          )
        )
      );
    })
  ),
  implement(jobRetry, (input) =>
    Effect.gen(function* retryJob() {
      const storage = yield* JobsStorage;

      return yield* command(storage.databasePath, { ...input, kind: "retry" });
    })
  ),
  implement(jobCancel, (input) =>
    Effect.gen(function* cancelJob() {
      const storage = yield* JobsStorage;

      return yield* command(storage.databasePath, { ...input, kind: "cancel" });
    })
  ),
  implement(jobDecide, (input) =>
    Effect.gen(function* decideJob() {
      const storage = yield* JobsStorage;

      yield* command(storage.databasePath, { ...input, kind: "decide" });

      return yield* dispatchApproved(storage.databasePath, input.id);
    })
  ),
  implement(jobContinue, (input) =>
    Effect.gen(function* continueJob() {
      const storage = yield* JobsStorage;
      const current = yield* show(storage.databasePath, input.id);

      if (!current.effect) {
        return yield* Effect.fail(
          new JobError({
            reason: "illegal",
            message: "There is no decision to reconcile.",
            next: "Use job_list to find legal next operations; job_continue only reconciles an existing decision.",
          })
        );
      }

      yield* command(storage.databasePath, { ...input, kind: "resume" });

      return yield* dispatchApproved(storage.databasePath, input.id);
    })
  ),
  jobListOperation,
] as const;
