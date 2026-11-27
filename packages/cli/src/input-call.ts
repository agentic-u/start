import { Approval } from "@agentic-u/operations";
import { invokerFor } from "@agentic-u/operations/code-mode/execute";
import { Console, Effect, FileSystem, Schema } from "effect";
import { Argument, Command, Flag } from "effect/cli";

import { operations } from "./registry.js";

export class InputCallError extends Schema.TaggedError<
  InputCallError,
  { readonly brand: unique symbol }
>()("InputCallError", {
  reason: Schema.Literals(["read", "invalid-json"]),
  message: Schema.String,
  next: Schema.String,
  cause: Schema.Unknown,
}) {}

// @effect-diagnostics-next-line unstableApiUsage:off -- Official file-input host command pinned to Effect 4.1.5.
export const inputCall = Command.make(
  "call",
  {
    // @effect-diagnostics-next-line unstableApiUsage:off -- Official operation argument pinned to Effect 4.1.5.
    operation: Argument.String("operation"),
    // @effect-diagnostics-next-line unstableApiUsage:off -- Official input-file flag pinned to Effect 4.1.5.
    input: Flag.String("input"),
    // @effect-diagnostics-next-line unstableApiUsage:off -- Official invocation approval flag pinned to Effect 4.1.5.
    yes: Flag.Boolean("yes").pipe(Flag.withDefault(false)),
  },
  ({ operation, input, yes }) =>
    Effect.gen(function* invokeInputFile() {
      // @effect-diagnostics-next-line unstableApiUsage:off -- Official file boundary pinned to Effect 4.1.5.
      const fs = yield* FileSystem.FileSystem;

      const text = yield* fs.readFileString(input).pipe(
        Effect.mapError(
          (cause) =>
            new InputCallError({
              reason: "read",
              message: "Could not read the operation input file.",
              next: "Pass --input with a readable JSON file.",
              cause,
            })
        )
      );

      const payload = yield* Schema.decodeEffect(
        Schema.fromJsonString(Schema.Json)
      )(text).pipe(
        Effect.mapError(
          (cause) =>
            new InputCallError({
              reason: "invalid-json",
              message: "The operation input file is not valid JSON.",
              next: "Correct the file's JSON syntax and call the operation again.",
              cause,
            })
        )
      );

      const invoke = yield* invokerFor(operations);
      const outcome = yield* invoke(operation, payload);

      if (outcome.ok) {
        return yield* Console.log(JSON.stringify(outcome.value, null, 2));
      }

      yield* Console.error(JSON.stringify(outcome.error));
      yield* Effect.sync(() => {
        process.exitCode = 1;
      });
    }).pipe(Effect.provide(yes ? Approval.allowAll : Approval.denyAll))
);
