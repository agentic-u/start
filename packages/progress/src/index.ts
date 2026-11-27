import { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";

import { Effect, Schema } from "effect";

const Text = Schema.NonEmptyString;

const common = {
  key: Text,
  way: Text,
  version: Text,
  at: Schema.String.check(
    Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u)
  ),
};

export const Command = Schema.Union([
  Schema.Struct({ ...common, kind: Schema.Literal("viewed") }),
  Schema.Struct({
    ...common,
    kind: Schema.Literal("started"),
    attempt: Text,
    originalInput: Schema.Json,
  }),
  Schema.Struct({
    ...common,
    kind: Schema.Literal("artifact"),
    attempt: Text,
    artifact: Text,
    interpretation: Schema.Json,
  }),
  Schema.Struct({
    ...common,
    kind: Schema.Literal("checked"),
    attempt: Text,
    artifactKey: Text,
    result: Schema.Literals(["passed", "failed"]),
    evidence: Schema.NonEmptyArray(Text),
    checkedBy: Text,
  }),
  Schema.Struct({
    ...common,
    kind: Schema.Literal("accepted"),
    attempt: Text,
    checkKey: Text,
    principal: Text,
    decision: Schema.Literals(["accepted", "rejected"]),
    note: Text,
  }),
]);

export type LearningCommand = typeof Command.Type;

export const History = Schema.Array(Command);

export class ProgressError extends Schema.TaggedError<ProgressError>()(
  "ProgressError",
  {
    reason: Schema.Literals([
      "invalid",
      "storage",
      "conflict",
      "missing-reference",
    ]),
    message: Schema.String,
    cause: Schema.optionalKey(Schema.Unknown),
  }
) {}

export const admitCommand = (
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Explicit unknown-input admission boundary for callers.
  raw: unknown
): Effect.Effect<LearningCommand, ProgressError> =>
  Schema.decodeUnknownEffect(Command)(raw).pipe(
    Effect.mapError(
      (cause) =>
        new ProgressError({
          reason: "invalid",
          message: "Progress command does not match the receipt contract.",
          cause,
        })
    )
  );

const validateReference = (
  history: readonly LearningCommand[],
  command: LearningCommand
): void => {
  if (command.kind === "viewed") {
    return;
  }

  if (command.kind === "started") {
    if (
      history.some(
        (row) => row.kind === "started" && row.attempt === command.attempt
      )
    ) {
      throw new ProgressError({
        reason: "conflict",
        message: "Attempt ID already exists.",
      });
    }

    return;
  }

  const start = history.find(
    (row) =>
      row.kind === "started" &&
      row.attempt === command.attempt &&
      row.way === command.way &&
      row.version === command.version
  );

  if (!start) {
    throw new ProgressError({
      reason: "missing-reference",
      message: "Start this attempt at the same way/version first.",
    });
  }

  if (
    command.kind === "checked" &&
    !history.some(
      (row) =>
        row.kind === "artifact" &&
        row.key === command.artifactKey &&
        row.attempt === command.attempt
    )
  ) {
    throw new ProgressError({
      reason: "missing-reference",
      message: "Check must reference a recorded artifact in this attempt.",
    });
  }

  if (
    command.kind === "accepted" &&
    !history.some(
      (row) =>
        row.kind === "checked" &&
        row.key === command.checkKey &&
        row.attempt === command.attempt
    )
  ) {
    throw new ProgressError({
      reason: "missing-reference",
      message:
        "Principal decision must reference a recorded check in this attempt.",
    });
  }
};

const storageError = (cause: unknown): ProgressError =>
  Schema.is(ProgressError)(cause)
    ? cause
    : new ProgressError({
        reason: "storage",
        message:
          "Could not read or commit local progress. Existing bytes are preserved; inspect the file before retrying.",
        cause,
      });

const transact = <A>(
  path: string,
  action: (db: DatabaseSync) => A
): Effect.Effect<A, ProgressError> =>
  Effect.try({
    try: () => {
      const db = new DatabaseSync(path);

      try {
        db.exec(
          "PRAGMA busy_timeout=15000; PRAGMA synchronous=FULL; BEGIN IMMEDIATE;"
        );

        try {
          db.exec(
            "CREATE TABLE IF NOT EXISTS receipts (sequence INTEGER PRIMARY KEY, body TEXT NOT NULL)"
          );
          const result = action(db);
          db.exec("COMMIT");

          return result;
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      } finally {
        db.close();
      }
    },
    catch: storageError,
  });

const readHistory = (db: DatabaseSync): readonly LearningCommand[] => {
  const rows = db.prepare("SELECT body FROM receipts ORDER BY sequence").all();
  const history: LearningCommand[] = [];

  for (const row of rows) {
    const command = Schema.decodeUnknownSync(Schema.fromJsonString(Command))(
      row.body
    );

    if (history.some((previous) => previous.key === command.key)) {
      throw new ProgressError({
        reason: "invalid",
        message:
          "Persisted history contains a repeated key. Preserve and inspect the database.",
      });
    }

    validateReference(history, command);
    history.push(command);
  }

  return history;
};

export const record = (
  path: string,
  command: LearningCommand
): Effect.Effect<readonly LearningCommand[], ProgressError> =>
  transact(path, (db) => {
    const history = readHistory(db);
    const previous = history.find((row) => row.key === command.key);
    const encode = Schema.encodeSync(Schema.fromJsonString(Command));

    if (previous) {
      if (!isDeepStrictEqual(previous, command)) {
        throw new ProgressError({
          reason: "conflict",
          message: "Idempotency key was already used with different content.",
        });
      }

      return history;
    }

    validateReference(history, command);
    db.prepare("INSERT INTO receipts(body) VALUES (?)").run(encode(command));

    return [...history, command];
  });

export const resume = (
  path: string
): Effect.Effect<readonly LearningCommand[], ProgressError> =>
  transact(path, readHistory);
