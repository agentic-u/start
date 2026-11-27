import { Effect } from "effect";

import { check } from "../../dist/index.js";

const catalog = {
  generation: "fictional-generation-one",
  data: { workflows: [], needs: [], documents: [], curriculum: {} },
  workflowNeeds: new Map(),
};

const receipts = await Effect.runPromise(
  check(catalog, "runtime:git", process.argv[2])
);

process.stdout.write(JSON.stringify(receipts));
