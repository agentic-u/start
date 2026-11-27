// @effect-diagnostics nodeBuiltinImport:off -- The lint package resolves its own immutable plugin files.
import { fileURLToPath } from "node:url";

import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";

import { defaultLayout } from "./plugins/project.ts";
import type { ProjectLayout } from "./plugins/project.ts";

const plugin = (file: string) =>
  fileURLToPath(
    new URL(
      `plugins/${file.replace(/\.ts$/u, import.meta.url.endsWith(".ts") ? ".ts" : ".js")}`,
      import.meta.url
    )
  );

export const createFenceConfig = (layout: ProjectLayout = defaultLayout) =>
  defineConfig({
    settings: { agenticU: layout },
    extends: [core],
    ignorePatterns: [
      ...(core.ignorePatterns ?? []),
      ".agent_sources/**",
      ".agent-sources/**",
      "**/dist/**",
      "node_modules/**",
      ".pi/**",
      ".cursor/**",
      ".claude/**",
      "scripts/hooks/**",
      "packages/fence/plugins/**",
      "skills/security-audit/**",
    ],
    jsPlugins: [
      plugin("effect-tests.ts"),
      plugin("no-comments.ts"),
      {
        name: "agentic-u-boundaries",
        specifier: plugin("boundaries.ts"),
      },
      {
        name: "agentic-u-patterns",
        specifier: plugin("patterns.ts"),
      },
      {
        name: "anti-slop",
        specifier: plugin("anti-slop/index.ts"),
      },
      {
        name: "landmines",
        specifier: plugin("landmines/index.ts"),
      },
      {
        name: "anti-slop-effect",
        specifier: plugin("anti-slop/effect/index.ts"),
      },
    ],
    overrides: [
      ...layout.viewRoots.map((root) => ({
        files: [`${root}/**/*.ts`],
        rules: {
          "unicorn/filename-case": [
            "error",
            { cases: { kebabCase: true, pascalCase: true } },
          ] as const,
        },
      })),
      {
        files: ["packages/catalog/**/*.ts", "apps/catalog/**/*.ts"],
        rules: {
          "unicorn/filename-case": [
            "error",
            { cases: { kebabCase: true, pascalCase: true } },
          ],
          "max-classes-per-file": ["error", 3],
        },
      },
      {
        files: [
          "**/*.{test,spec,test-d,spec-d}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
          "**/__tests__/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
        ],
        rules: {
          "promise/prefer-await-to-then": "off",
        },
      },
      {
        files: [
          "**/*.{test,spec,test-d,spec-d}.{mts,cts,mjs,cjs}",
          "**/__tests__/**/*.{mts,cts,mjs,cjs}",
        ],
        rules: {
          "no-empty-function": "error",
          "promise/prefer-await-to-then": "error",
        },
      },
      {
        files: [
          "apps/*/src/features/**",
          "apps/*/src/client/**",
          "apps/*/src/dev/features/**",
          "apps/*/src/dev/client/**",
        ],
        rules: {
          "agentic-u-boundaries/no-browser-server-imports": "error",
        },
      },
      {
        files: ["apps/*/src/features/**", "apps/*/src/dev/features/**"],
        rules: {
          "agentic-u-boundaries/no-feature-transport": "error",
        },
      },
      {
        files: [
          "apps/site/scripts/content-lib.ts",
          "apps/site/scripts/generate-content.ts",
          "apps/site/scripts/wiki-prose.ts",
        ],
        rules: {
          "agentic-u-patterns/audited-content-regex": "error",
        },
      },
    ],
    rules: {
      "anti-slop-effect/no-manual-effect-error-tag": "error",
      "anti-slop-effect/no-manual-tag-comparison": "error",
      "anti-slop-effect/no-manual-tagged-construction": "error",
      "anti-slop-effect/no-service-constructor-imports": "error",
      "anti-slop-effect/prefer-effect-match": "error",
      "anti-slop-effect/no-manual-tagged-type": "error",
      "anti-slop-effect/prefer-tagged-error-handling": "error",
      "anti-slop-effect/require-operation-span": "error",
      "anti-slop-effect/require-cause-when-narrowing": "error",
      "anti-slop/max-ternary-depth": "error",
      "anti-slop/no-array-filter-map": "error",
      "anti-slop/no-chained-type-assertions": "error",
      "anti-slop/no-conditional-empty-object-spread": "error",
      "anti-slop/no-known-value-widening": "error",
      "anti-slop/no-module-mocking": "error",
      "anti-slop/no-object-parameters": "error",
      "anti-slop/no-reduce-accumulator-copy": "error",
      "anti-slop/no-reflect-apply": "error",
      "anti-slop/no-reflect-get": "error",
      "anti-slop/no-runtime-typeof": "error",
      "anti-slop/no-shape-in-symbol-names": "error",
      "anti-slop/no-unknown-parameters": "error",
      "anti-slop/no-unknown-returns": "error",
      "anti-slop/no-unknown-type-aliases": "error",
      "anti-slop/no-unsafe-dictionary-type": "error",
      "anti-slop/no-widen-then-assert": "error",
      "anti-slop/require-readable-spacing": "error",
      "anti-slop/require-safety-comment-for-type-assertion": "error",
      "effect-tests/no-manual-effect-runtime-in-tests": "error",
      "jsdoc/require-param-description": "off",
      "jsdoc/require-returns-description": "off",
      "landmines/no-fixed-sleep": "warn",
      "landmines/no-flake-masking": "warn",
      "landmines/no-flake-masking-timeout": ["warn", { check: "timeout" }],
      "landmines/no-test-doubles": "warn",
      "landmines/no-unsignaled-poll": "warn",
      "no-comments/directive-reason": "error",
      "no-comments/no-comments": "error",
      "oxc/no-accumulating-spread": "error",
      "promise/prefer-await-to-then": "error",
      "agentic-u-boundaries/no-browser-globals-on-server": "error",
      "agentic-u-boundaries/no-browser-server-imports": "error",
      "agentic-u-boundaries/no-code-snippets-in-runtime": "error",
      "agentic-u-boundaries/no-core-adapters": "error",
      "agentic-u-boundaries/no-cross-layer-imports": "error",
      "agentic-u-boundaries/no-devtools-in-production": "error",
      "agentic-u-boundaries/no-hand-rolled-surface": "error",
      "agentic-u-patterns/acquire-release-constructs-in-acquire-body": "error",
      "agentic-u-patterns/contract-binding-matches-name": "error",
      "agentic-u-patterns/flag-removal-date": "error",
      "agentic-u-patterns/learn-snippet-idiom": "error",
      "agentic-u-patterns/no-hand-rolled-hex": "error",
      "agentic-u-patterns/no-module-level-mutable-state": "error",
      "agentic-u-patterns/no-shared-pending-cache": "error",
      "agentic-u-patterns/no-sleep-in-loop": "error",
      "agentic-u-patterns/retain-needs-stage-policy": "error",
      "agentic-u-patterns/shared-waiters": "error",
      "agentic-u-patterns/watch-effect-actors": "error",
      "typescript/promise-function-async": "off",
      "unicorn/no-useless-undefined": ["error", { checkArguments: true }],
      "unicorn/throw-new-error": "off",
    },
  });

export default createFenceConfig();
