import { Effect } from "effect";

import { admitCommand, record, resume } from "../dist/index.js";

const [path, raw] = process.argv.slice(2);

const result = await Effect.runPromise(
  raw
    ? admitCommand(JSON.parse(raw)).pipe(
        Effect.flatMap((command) => record(path, command))
      )
    : resume(path)
);

process.stdout.write(JSON.stringify(result));
