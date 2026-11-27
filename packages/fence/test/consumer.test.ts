// @effect-diagnostics nodeBuiltinImport:off -- These fixtures run the installed lint binary in a separate caller root.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");

const layout = {
  runtimeRoots: ["surface", "kernel"],
  browserFiles: [
    "apps/agenticu/src/main.ts",
    "apps/agenticu/src/lib/storage.ts",
  ],
  browserRoots: [],
  viewRoots: ["apps/agenticu/src/components", "apps/agenticu/src/pages"],
  buildFiles: ["apps/agenticu/src/prerender.ts"],
};

const lint = (
  rule: string,
  source: string,
  file = "apps/agenticu/src/components/Copy.ts"
) => {
  const caller = mkdtempSync(path.join(tmpdir(), "agenticu-consumer-"));
  const fixture = path.join(caller, file);
  const config = path.join(caller, "oxlint.json");

  mkdirSync(path.dirname(fixture), { recursive: true });
  writeFileSync(fixture, source);
  writeFileSync(
    config,
    JSON.stringify({
      categories: { correctness: "off" },
      settings: { agenticU: layout },
      jsPlugins: [
        {
          name: "agentic-u-boundaries",
          specifier: path.join(root, "packages/fence/plugins/boundaries.ts"),
        },
        {
          name: "agentic-u-patterns",
          specifier: path.join(root, "packages/fence/plugins/patterns.ts"),
        },
        {
          name: "effect-tests",
          specifier: path.join(root, "packages/fence/plugins/effect-tests.ts"),
        },
      ],
      rules: { [rule]: "error" },
    })
  );

  try {
    const result = spawnSync(
      path.join(root, "node_modules/.bin/oxlint"),
      ["-c", config, fixture],
      { cwd: caller, encoding: "utf-8" }
    );

    if (result.error !== undefined) {
      throw result.error;
    }

    return {
      status: result.status,
      output: `${result.stdout}${result.stderr}`,
    };
  } finally {
    rmSync(caller, { recursive: true, force: true });
  }
};

describe("actual Effect UI ownership in a separate consumer", () => {
  it.each([
    'import { Command } from "@effect/ui"; export const Copy = Command.make("Copy", { args: {} }, () => Effect.sync(() => navigator.clipboard.writeText("prompt")));',
    'import { Command as C } from "@effect/ui"; export const Copy = C.make("Copy", { args: {} }, () => Effect.sync(() => document.title));',
    'import { Mount } from "@effect/ui"; export const Player = Mount.makeStream("Player", { args: {} }, (node, args, changes) => Stream.fromEffect(Effect.sync(() => window.location.href)));',
  ])(
    "accepts browser work in the actual named Command/Mount callback",
    (source) => {
      const result = lint(
        "agentic-u-boundaries/no-browser-globals-on-server",
        source
      );

      expect(result.status, result.output).toBe(0);
    }
  );

  it.each([
    'import { Html } from "@effect/ui/html"; export const View = Html.component({ name: "View", view: () => document.title });',
    'const Command = { make: (name, options, run) => run() }; Command.make("fake", {}, () => document.title);',
    'import { Command } from "@effect/ui"; Command.make(document.title, { args: {} }, () => Effect.void);',
  ])(
    "rejects browser work outside the real callback, including lookalikes",
    (source) => {
      const result = lint(
        "agentic-u-boundaries/no-browser-globals-on-server",
        source
      );

      expect(result.status, result.output).toBe(1);
      expect(result.output).toContain("browser-globals-on-server");
    }
  );

  it("keeps browser bootstrap and declared adapter files distinct from SSR", () => {
    const rule = "agentic-u-boundaries/no-browser-globals-on-server";

    expect(
      lint(
        rule,
        "export const root = document.body;",
        "apps/agenticu/src/main.ts"
      ).status
    ).toBe(0);
    expect(
      lint(
        rule,
        "export const read = () => localStorage.getItem('key');",
        "apps/agenticu/src/lib/storage.ts"
      ).status
    ).toBe(0);
    expect(
      lint(
        rule,
        "export const render = () => document.title;",
        "apps/agenticu/src/prerender.ts"
      ).status
    ).toBe(1);
  });

  it("rejects Node and the exact publisher build entry in a browser component", () => {
    const rule = "agentic-u-boundaries/no-browser-server-imports";

    expect(
      lint(
        rule,
        'import { readFile } from "node:fs"; export const read = readFile;'
      ).status
    ).toBe(1);
    expect(
      lint(
        rule,
        'import { catalog } from "../prerender.ts"; export const read = catalog;'
      ).status
    ).toBe(1);
    expect(
      lint(
        rule,
        'import { readFile } from "node:fs"; export const read = readFile;',
        "apps/agenticu/src/prerender.ts"
      ).status
    ).toBe(0);
  });

  it("rejects view transport and accepts transport inside its actual Command", () => {
    const rule = "agentic-u-boundaries/no-feature-transport";

    expect(
      lint(
        rule,
        'import { Html } from "@effect/ui/html"; export const View = Html.component({ view: () => fetch("/api") });'
      ).status
    ).toBe(1);
    expect(
      lint(
        rule,
        'import { Command } from "@effect/ui"; export const Load = Command.make("Load", { args: {} }, () => Effect.tryPromise(() => fetch("/api")));'
      ).status
    ).toBe(0);
    expect(
      lint(
        rule,
        'const Command = { make: (name, options, body) => body() }; Command.make("fake", {}, () => fetch("/api"));'
      ).status
    ).toBe(1);
  });

  it.each(["kernel/laws.ts", "surface/publisher.ts"])(
    "activates original runtime rules on %s",
    (file) => {
      const rule = "agentic-u-patterns/no-module-level-mutable-state";

      expect(lint(rule, "export let request = 0;", file).status).toBe(1);
      expect(lint(rule, "export const request = 0;", file).status).toBe(0);
    }
  );

  it("recognizes the owned Vitest filename as an Effect test boundary", () => {
    const rule = "effect-tests/no-manual-effect-runtime-in-tests";

    expect(
      lint(rule, "Effect.runPromise(program);", "test/agenticu-ssr.vitest.mjs")
        .status
    ).toBe(1);
    expect(
      lint(
        rule,
        "it.effect('SSR', () => program);",
        "test/agenticu-ssr.vitest.mjs"
      ).status
    ).toBe(0);
  });
});
