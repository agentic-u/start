import { Approval } from "@agentic-u/operations";
import { Effect, Schema } from "effect";

import { admitCommand, command, show, run } from "../dist/index.js";
import { JobsStorage, jobOperations } from "../dist/operations.js";

const [path, action, payload] = process.argv.slice(2);

let effect;

switch (action) {
  case "operation-crash":
  case "operation-continue": {
    const { input, progress } = JSON.parse(payload);
    const name = action === "operation-crash" ? "job_decide" : "job_continue";
    const operation = jobOperations.find((item) => item.contract.name === name);

    if (!operation) {
      throw new Error("Missing supported operation");
    }

    effect = Schema.decodeUnknownEffect(operation.contract.input)(input).pipe(
      Effect.flatMap((value) => operation.handler(value)),
      Effect.provideService(JobsStorage, {
        databasePath: path,
        progressPath: progress,
        houseDirectory: path,
        afterDecisionDispatch: () => {
          if (action === "operation-crash") {
            process.kill(process.pid, "SIGKILL");
          }
        },
      }),
      Effect.provide(Approval.allowAll)
    );
    break;
  }

  case "command": {
    effect = admitCommand(JSON.parse(payload)).pipe(
      Effect.flatMap((value) => command(path, value))
    );
    break;
  }

  case "run": {
    effect = run(path, payload, { authorizeDecision: () => Effect.void });
    break;
  }

  case "crash": {
    effect = run(path, payload, {
      authorizeDecision: () => Effect.void,
      afterDecisionDispatch: () => process.kill(process.pid, "SIGKILL"),
    });
    break;
  }

  default: {
    effect = show(path, payload);
  }
}

console.log(JSON.stringify(await Effect.runPromise(effect)));
