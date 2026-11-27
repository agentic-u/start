import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";

import {
  baselineDrift,
  budgetFindings,
  budgetRuleIds,
  growthWithoutReason,
  readBaseline,
} from "./landmines/baseline.ts";

const baselinePath = "scripts/landmines/baseline.json";

const run = (command, args) => {
  const result = spawnSync(command, args, { encoding: "utf-8" });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `${command} exited ${result.status}\n${result.stderr}\n${result.stdout}`
    );
  }

  return result.stdout;
};

const scope = readdirSync("packages", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) =>
    ["src", "test"].map((part) => `packages/${entry.name}/${part}`)
  )
  .filter((path) => existsSync(path));

const output = run(process.execPath, [
  "node_modules/oxlint/bin/oxlint",
  "--config",
  "scripts/landmines/oxlint.config.ts",
  "-A",
  "all",
  ...budgetRuleIds.flatMap((id) => ["-W", `landmines/${id}`]),
  "--format",
  "json",
  ...scope,
  "scripts",
  "packages/checkers/compiler-parity.test.mjs",
]);

const baseline = readBaseline(readFileSync(baselinePath, "utf-8"));

const errors = baselineDrift(baseline, budgetFindings(output));

const base = process.env.LANDMINES_BASE;

if (base) {
  if (!/^[0-9a-f]{40}$/u.test(base)) {
    throw new Error("LANDMINES_BASE must be an exact commit SHA");
  }

  const exists =
    run("git", ["ls-tree", "--name-only", base, "--", baselinePath]).trim() ===
    baselinePath;

  errors.push(
    ...growthWithoutReason(
      exists
        ? readBaseline(run("git", ["show", `${base}:${baselinePath}`]))
        : {},
      baseline
    )
  );
}

if (errors.length) {
  throw new Error(errors.join("\n"));
}
