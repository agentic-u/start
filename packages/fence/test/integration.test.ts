// @effect-diagnostics nodeBuiltinImport:off -- These fixtures exercise the actual Oxlint process and filesystem admission boundary.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");

const binary =
  process.env.OXLINT_BIN ?? path.join(root, "node_modules/.bin/oxlint");

const plugins = {
  "anti-slop": "anti-slop/index.ts",
  "anti-slop-effect": "anti-slop/effect/index.ts",
  "agentic-u-boundaries": "boundaries.ts",
  "agentic-u-patterns": "patterns.ts",
  "effect-tests": "effect-tests.ts",
  "no-comments": "no-comments.ts",
  landmines: "landmines/index.ts",
};

const lint = (
  rule: string,
  source: string,
  area = "packages/operations/src",
  filename = "fixture.ts",
  repositoryConfig = false
) => {
  const directory = mkdtempSync(path.join(tmpdir(), "agenticu-fence-"));
  const fixture = path.join(directory, area, filename);
  const config = path.join(directory, "oxlint.json");

  mkdirSync(path.dirname(fixture), { recursive: true });
  writeFileSync(fixture, source);
  writeFileSync(
    config,
    JSON.stringify({
      categories: { correctness: "off" },
      jsPlugins: Object.entries(plugins).map(([name, file]) => ({
        name,
        specifier: path.join(root, "packages/fence/plugins", file),
      })),
      rules: { [rule]: "error" },
    })
  );

  try {
    const result = spawnSync(
      binary,
      [
        "-c",
        repositoryConfig ? path.join(root, "oxlint.config.ts") : config,
        "--no-ignore",
        fixture,
      ],
      { cwd: root, encoding: "utf-8" }
    );

    if (result.error) {
      throw result.error;
    }

    return {
      status: result.status,
      output: `${result.stdout}${result.stderr}`,
    };
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
};

const cases = [
  [
    "anti-slop/no-array-filter-map",
    "const result = [1, 2].filter(keep).map(project);",
    "const result = [1, 2].values().filter(keep).map(project).toArray();",
  ],
  [
    "anti-slop/no-chained-type-assertions",
    "const result = value as unknown as string;",
    "const result = String(value);",
  ],
  [
    "anti-slop/no-conditional-empty-object-spread",
    "const result = { ...(ready ? { value } : {}) };",
    "const result = { value };",
  ],
  [
    "anti-slop/no-object-parameters",
    "function accept(value: object) {}",
    "function accept(value: { readonly name: string }) {}",
  ],
  [
    "anti-slop/no-reflect-get",
    "const result = Reflect.get(value, key);",
    "const result = value.name;",
  ],
  [
    "anti-slop/no-runtime-typeof",
    'const result = typeof value === "string";',
    'const result = typeof window !== "undefined";',
  ],
  [
    "anti-slop/no-unknown-parameters",
    "function accept(value: unknown) {}",
    "function accept(value: string) {}",
  ],
  [
    "anti-slop/no-unknown-returns",
    "function result(): unknown { return value; }",
    "function result(): string { return value; }",
  ],
  [
    "anti-slop/no-unknown-type-aliases",
    "type Value = unknown;",
    "type Value = string;",
  ],
  [
    "anti-slop/no-unsafe-dictionary-type",
    "type Value = Record<string, unknown>;",
    "type Value = { readonly name: string };",
  ],
  [
    "anti-slop/require-safety-comment-for-type-assertion",
    "const result = value as string;",
    "// SAFETY: This fixture models a checked parser result.\nconst result = value as string;",
  ],
  [
    "agentic-u-boundaries/no-browser-globals-on-server",
    "export const result = document.title;",
    "export const result = (title: string) => title;",
  ],
  [
    "agentic-u-boundaries/no-cross-layer-imports",
    'import { page } from "../../../apps/site/src/page.ts";',
    'import { Effect } from "effect";',
  ],
  [
    "agentic-u-boundaries/no-hand-rolled-surface",
    "navigator.modelContext.registerTool(tool);",
    "export const result = toWebMcp(operation);",
  ],
  [
    "agentic-u-patterns/contract-binding-matches-name",
    'import { defineContract } from "@agentic-u/operations/contract"; const wrong = defineContract("search", {});',
    'import { defineContract } from "@agentic-u/operations/contract"; const searchContract = defineContract("search", {});',
  ],
  [
    "agentic-u-patterns/no-module-level-mutable-state",
    "export let count = 0;",
    "export const count = 0;",
  ],
  [
    "agentic-u-patterns/no-shared-pending-cache",
    'import { Effect } from "effect"; export const cached = Effect.cached(Effect.succeed(1), "Infinity");',
    'import { Effect } from "effect"; export const fetch = (request) => Effect.gen(function* () { return yield* Effect.cached(read(request), "Infinity"); });',
  ],
  [
    "agentic-u-patterns/no-sleep-in-loop",
    'import { Effect } from "effect"; function* work() { while (true) { yield* Effect.sleep(1); } }',
    'import { Effect } from "effect"; function* work() { yield* Effect.sleep(1); }',
  ],
  [
    "agentic-u-patterns/watch-effect-actors",
    'import { createEffectActor } from "@xstate/effect"; export const actor = createEffectActor(machine);',
    'import { createEffectActor } from "@xstate/effect"; import { watchActor } from "@agentic-u/operations/actor-watch"; const actor = createEffectActor(machine); watchActor("machine", actor);',
  ],
  [
    "no-comments/directive-reason",
    "// eslint-disable-next-line no-unused-vars\nconst result = 1;",
    "// eslint-disable-next-line no-unused-vars -- The fixture deliberately declares an unused binding.\nconst result = 1;",
  ],
] as const;

describe("AgenticU package enforcement through the real Oxlint binary", () => {
  it("enforces the shipped root configuration on an operations package path", () => {
    const rule = "anti-slop/no-unknown-type-aliases";

    const rejected = lint(
      rule,
      "export type Rejected = unknown;",
      "packages/operations/src",
      "fixture.ts",
      true
    );

    const accepted = lint(
      rule,
      "export type Accepted = string;",
      "packages/operations/src",
      "fixture.ts",
      true
    );

    expect(rejected.status, rejected.output).toBe(1);
    expect(rejected.output).toContain("no-unknown-type-aliases");
    expect(accepted.status, accepted.output).toBe(0);
  });

  it.each(cases)(
    "%s rejects the defect and accepts its neighbor",
    (rule, invalid, valid) => {
      const rejected = lint(rule, invalid);

      expect(rejected.status, rejected.output).toBe(1);
      expect(rejected.output).toContain(rule.split("/")[1]);

      const accepted = lint(rule, valid);

      expect(accepted.status, accepted.output).toBe(0);
    }
  );

  it("allows projection constructors inside the owning operations package", () => {
    const source =
      'import { Rpc } from "effect/unstable/rpc"; export const projected = Rpc.make("search");';

    expect(
      lint("agentic-u-boundaries/no-hand-rolled-surface", source).status
    ).toBe(0);
    expect(
      lint(
        "agentic-u-boundaries/no-hand-rolled-surface",
        source,
        "apps/cli/src"
      ).status
    ).toBe(1);
  });

  it("allows only browser contracts from the operations package", () => {
    const rule = "agentic-u-boundaries/no-browser-server-imports";
    const area = "apps/site/src/features/search";

    expect(
      lint(
        rule,
        'import { group } from "@agentic-u/operations/rpc-group";',
        area
      ).status
    ).toBe(0);
    expect(
      lint(
        rule,
        'import { handler } from "@agentic-u/operations/implement";',
        area
      ).status
    ).toBe(1);
    expect(
      lint(
        rule,
        'import { group } from "@agentic-u/operations/rpc-group";',
        "packages/operations/src"
      ).status
    ).toBe(0);
  });

  it("requires the Effect test runtime only in tests", () => {
    const rule = "effect-tests/no-manual-effect-runtime-in-tests";

    const source =
      'import { Effect } from "effect"; Effect.runPromise(program);';

    expect(
      lint(rule, source, "packages/operations/test", "fixture.test.ts").status
    ).toBe(1);
    expect(lint(rule, source, "packages/operations/src").status).toBe(0);
    expect(
      lint(
        rule,
        'it.effect("work", () => program);',
        "packages/operations/test",
        "fixture.test.ts"
      ).status
    ).toBe(0);
  });
});
