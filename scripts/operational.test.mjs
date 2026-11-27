import assert from "node:assert/strict";
import { test } from "node:test";

import { baselineDrift, growthWithoutReason } from "./landmines/baseline.ts";
import { applyCommandPolicy } from "./vcs-command-policy.js";

test("donor policy blocks bypass spellings and permits neighboring reads", () => {
  for (const command of [
    "git commit --no-verify",
    "git commit -nm wip",
    "env LEFTHOOK=0 git commit",
    "git -c core.hooksPath=/dev/null commit",
    "git config set core.hooksPath .nohooks",
    "rm -rf .git/hooks",
    "pnpm exec lefthook uninstall",
    "bash -c 'git commit -n'",
  ]) {
    assert.equal(applyCommandPolicy(command).action, "block", command);
  }

  for (const command of [
    "git commit -m '--no-verify is banned'",
    "git log -n 5",
    "git push -n origin main",
    "git config --get core.hooksPath",
    "cat .git/hooks/pre-commit",
    "LEFTHOOK=1 git commit",
    "pnpm check",
  ]) {
    assert.equal(applyCommandPolicy(command).action, "allow", command);
  }
});

test("exact budget accounting rejects added, stale and recycled allowances", () => {
  const budget = ["test", ["real process exit"], "timeout", "15000"];
  const changed = ["test", ["real process exit"], "timeout", "30000"];

  const baseline = {
    "test/process.test.ts": [
      { budget, reason: "Wait for observed child exit" },
    ],
  };

  assert.deepEqual(
    baselineDrift(baseline, new Map([["test/process.test.ts", [budget]]])),
    []
  );
  assert.equal(
    baselineDrift({}, new Map([["test/process.test.ts", [budget]]])).length,
    1
  );
  assert.equal(baselineDrift(baseline, new Map()).length, 1);
  assert.equal(
    growthWithoutReason(baseline, {
      "test/process.test.ts": [
        { budget: changed, reason: "Wait for observed child exit" },
      ],
    }).length,
    1
  );
  assert.deepEqual(
    growthWithoutReason(baseline, {
      "test/process.test.ts": [
        {
          budget: changed,
          reason: "Wait for two independently observed child exits",
        },
      ],
    }),
    []
  );
});
