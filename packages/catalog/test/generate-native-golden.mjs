import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Effect } from "effect";

const [checkout, destination] = process.argv.slice(2);

if (!checkout || !destination) {
  throw new Error(
    "usage: node generate-native-golden.mjs <owning-checkout> <destination>"
  );
}

const { readLibrary } = await import(
  pathToFileURL(path.resolve(checkout, "surface/library.ts")).href
);

const { handlers } = await import(
  pathToFileURL(path.resolve(checkout, "surface/calls.ts")).href
);

const library = readLibrary();

const native = handlers(library);

const cases = [];

for (const input of [{}, { words: "browser" }, { words: "answer proof" }]) {
  cases.push({ operation: "find", input });
}

for (const workflow of library.workflows.values()) {
  for (const [operation, input] of [
    ["read", { id: workflow.id }],
    ...workflow.steps.map((step) => [
      "read",
      { id: workflow.id, step: step.id },
    ]),
    ["needs", { id: workflow.id }],
    ["ready", { id: workflow.id, have: [] }],
    ["ready", { id: workflow.id, have: [...library.needs.keys()] }],
  ]) {
    cases.push({ operation, input });
  }
}

const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: checkout,
  encoding: "utf-8",
}).trim();

await writeFile(
  destination,
  `${JSON.stringify(
    {
      source: {
        commit,
        files: [
          "surface/calls.ts",
          "surface/library.ts",
          "surface/ready.ts",
          "kernel/workflow.ts",
          "kernel/laws.ts",
        ],
      },
      cases: await Promise.all(
        cases.map(async (example) => ({
          ...example,
          output: await Effect.runPromise(
            native[example.operation](example.input)
          ),
        }))
      ),
    },
    null,
    2
  )}\n`
);
