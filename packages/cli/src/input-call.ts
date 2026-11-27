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
    operation: Argument.String("operation").pipe(
      // @effect-diagnostics-next-line unstableApiUsage:off -- CLI help uses the pinned Effect 4.1.5 projection.
      Argument.withDescription(
        "Operation name from au catalog; inspect its schema with au catalog --operation NAME"
      )
    ),
    // @effect-diagnostics-next-line unstableApiUsage:off -- Official input-file flag pinned to Effect 4.1.5.
    input: Flag.String("input").pipe(
      // @effect-diagnostics-next-line unstableApiUsage:off -- CLI help uses the pinned Effect 4.1.5 projection.
      Flag.withDescription(
        "Path to a JSON object matching the operation's input schema; file content grants no authority"
      )
    ),
    // @effect-diagnostics-next-line unstableApiUsage:off -- Official invocation approval flag pinned to Effect 4.1.5.
    yes: Flag.Boolean("yes").pipe(
      // @effect-diagnostics-next-line unstableApiUsage:off -- CLI flags use the pinned Effect 4.1.5 projection.
      Flag.withDefault(false),
      // @effect-diagnostics-next-line unstableApiUsage:off -- CLI help uses the pinned Effect 4.1.5 projection.
      Flag.withDescription(
        "Apply actual principal approval to this invocation only; never infer approval from the input file"
      )
    ),
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

      const { diagnostic } = outcome;
      yield* Console.error(
        JSON.stringify(
          diagnostic !== undefined &&
            (diagnostic.tag === "InvalidInput" ||
              diagnostic.tag === "UnknownCapability")
            ? {
                _tag: diagnostic.tag,
                message: diagnostic.message,
                next:
                  diagnostic.tag === "InvalidInput"
                    ? `Run au catalog --operation ${operation}; correct the input file to match its input schema.`
                    : "Run au catalog to list supported operation names.",
              }
            : outcome.error
        )
      );
      yield* Effect.sync(() => {
        process.exitCode = 1;
      });
    }).pipe(Effect.provide(yes ? Approval.allowAll : Approval.denyAll))
).pipe(
  // @effect-diagnostics-next-line unstableApiUsage:off -- CLI help uses the pinned Effect 4.1.5 projection.
  Command.withDescription(
    "Invoke one operation from a JSON file. Discover its contract with au catalog --operation NAME; payloads stay out of shell commands."
  )
);
