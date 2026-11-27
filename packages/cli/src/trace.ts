import { CallWatch } from "@agentic-u/operations";
import {
  Config,
  Effect,
  Exit,
  FileSystem,
  Option,
  Predicate,
  Schema,
  Tracer,
} from "effect";

export class TraceError extends Schema.TaggedError<TraceError>()("TraceError", {
  message: Schema.String,
  cause: Schema.Unknown,
}) {}

export const operationWatch = CallWatch.of({
  around: (contract, _input, run) =>
    run.pipe(Effect.withSpan(`agenticu.${contract.name}`)),
});

export const withLocalTrace = <A, E, R>(program: Effect.Effect<A, E, R>) =>
  Effect.gen(function* traceLocalOperations() {
    const destination = yield* Config.option(Config.NonEmptyString("AU_TRACE"));

    if (Option.isNone(destination)) {
      return yield* program;
    }

    // @effect-diagnostics-next-line unstableApiUsage:off -- Official local filesystem host service pinned to Effect 4.1.5.
    const fs = yield* FileSystem.FileSystem;
    const spans: Tracer.NativeSpan[] = [];

    const tracer = Tracer.make({
      span: (options) => {
        const span = new Tracer.NativeSpan(options);

        if (options.name.startsWith("agenticu.")) {
          spans.push(span);
        }

        return span;
      },
    });

    return yield* program.pipe(
      Effect.withTracer(tracer),
      Effect.onExit(() => {
        const lines = spans.flatMap((span) => {
          if (!Predicate.isTagged(span.status, "Ended")) {
            return [];
          }

          const generation = Schema.decodeUnknownOption(Schema.String)(
            span.attributes.get("catalog.generation")
          );

          return [
            JSON.stringify({
              operation: span.name.slice("agenticu.".length),
              revision: "@agentic-u/cli@0.1.0",
              catalogGeneration: Option.getOrNull(generation),
              outcome: Exit.isSuccess(span.status.exit) ? "success" : "failure",
              elapsedNanoseconds: String(
                span.status.endTime - span.status.startTime
              ),
            }),
          ];
        });

        return fs
          .writeFileString(
            destination.value,
            lines.length === 0 ? "" : `${lines.join("\n")}\n`,
            {
              flag: "a",
              mode: 0o600,
            }
          )
          .pipe(
            Effect.mapError(
              (cause) =>
                new TraceError({
                  message: "Could not append the selected local trace file.",
                  cause,
                })
            )
          );
      })
    );
  });
