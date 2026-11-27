// @effect-diagnostics nodeBuiltinImport:off -- This process-boundary test executes the real installed compilers.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  globSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

const compilers = ["effect-tsrs", "tsc", "tsrs"];

const compile = (directory, compiler) => {
  const result = spawnSync(
    path.join(root, "node_modules/.bin", compiler),
    compiler === "effect-tsrs"
      ? [
          "diagnostics",
          "--project",
          "tsconfig.json",
          "--strict",
          "--type-check",
        ]
      : ["--noEmit", "-p", "tsconfig.json", "--pretty", "false"],
    { cwd: directory, encoding: "utf-8" }
  );

  if (result.error !== undefined) {
    throw result.error;
  }

  const output = `${result.stdout}${result.stderr}`;

  const diagnostics = [
    ...output.matchAll(
      /^(?<file>.+)\((?<line>\d+),(?<column>\d+)\): (?<severity>error|warning|suggestion|message) TS(?<code>\d+):/gmu
    ),
  ];

  assert.notEqual(result.status, null, output);
  assert.ok(
    result.status === 0 ||
      diagnostics.some(
        ({ groups }) =>
          groups.severity === "error" || groups.severity === "warning"
      ),
    `${compiler} failed without diagnostics:\n${output}`
  );

  return {
    status: result.status,
    output,
    errors: [
      ...new Set(
        diagnostics.flatMap(({ groups }) =>
          groups.severity === "error"
            ? [
                `${path.relative(root, path.resolve(directory, groups.file))}:${groups.line}:${groups.column}:TS${groups.code}`,
              ]
            : []
        )
      ),
    ].toSorted(),
    ordinaryErrors: [
      ...new Set(
        diagnostics.flatMap(({ groups }) =>
          groups.severity === "error" &&
          (Number(groups.code) < 377_000 || Number(groups.code) > 377_999)
            ? [
                `${path.relative(root, path.resolve(directory, groups.file))}:${groups.line}:${groups.column}:TS${groups.code}`,
              ]
            : []
        )
      ),
    ].toSorted(),
  };
};

const fixture = (run) => {
  mkdirSync(path.join(root, ".cache"), { recursive: true });
  const directory = mkdtempSync(path.join(root, ".cache/compiler-parity-"));
  writeFileSync(
    path.join(directory, "tsconfig.json"),
    JSON.stringify({
      extends: "../../tsconfig.base.json",
      files: ["fixture.ts"],
    })
  );

  try {
    run(directory, path.join(directory, "fixture.ts"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

test("real compilers reject ordinary TypeScript and accept its valid neighbor", () => {
  fixture((directory, source) => {
    writeFileSync(source, "export const value: string = 1;\n");
    const results = compilers.map((compiler) => compile(directory, compiler));

    for (const result of results) {
      assert.notEqual(result.status, 0, result.output);
      assert.equal(result.errors.length, 1, result.output);
      assert.match(result.errors[0], /:1:14:TS2322$/u);
    }

    writeFileSync(source, 'export const value: string = "valid";\n');

    for (const compiler of compilers) {
      const result = compile(directory, compiler);
      assert.equal(result.status, 0, result.output);
      assert.deepEqual(result.errors, []);
    }
  });
});

test("strict Effect diagnostics reject a floating Effect that plain TypeScript accepts", () => {
  fixture((directory, source) => {
    writeFileSync(
      source,
      'import { Effect } from "effect";\nexport const value = Effect.gen(function* () {\n  Effect.succeed(1);\n});\n'
    );

    for (const compiler of ["effect-tsrs", "tsc"]) {
      const result = compile(directory, compiler);
      assert.notEqual(result.status, 0, `${compiler}: ${result.output}`);
      assert.match(result.output, /floatingEffect/u);
      assert.deepEqual(result.ordinaryErrors, [], result.output);
    }

    const plain = compile(directory, "tsrs");
    assert.equal(plain.status, 0, plain.output);
    writeFileSync(
      source,
      'import { Effect } from "effect";\nexport const value = Effect.succeed(1);\n'
    );

    for (const compiler of compilers) {
      const result = compile(directory, compiler);
      assert.equal(result.status, 0, result.output);
    }
  });
});

const workspaces = globSync("packages/*/package.json", { cwd: root })
  .flatMap((file) =>
    existsSync(path.join(root, path.dirname(file), "tsconfig.json"))
      ? [path.dirname(file)]
      : []
  )
  .toSorted();

test("at least one real workspace participates in compiler parity", () =>
  assert.ok(workspaces.length > 0));

for (const workspace of workspaces) {
  test(`${workspace}: compiler diagnostic and exit verdict parity`, () => {
    const directory = path.join(root, workspace);
    const effect = compile(directory, "effect-tsrs");
    const tsc = compile(directory, "tsc");
    const plain = compile(directory, "tsrs");
    const evidence = `effect-tsrs (${effect.status}):\n${effect.output}\ntsc (${tsc.status}):\n${tsc.output}\ntsrs (${plain.status}):\n${plain.output}`;
    assert.equal(effect.status === 0, tsc.status === 0, evidence);
    assert.deepEqual(effect.errors, tsc.errors, evidence);
    assert.deepEqual(plain.ordinaryErrors, tsc.ordinaryErrors, evidence);
    assert.equal(plain.status === 0, tsc.ordinaryErrors.length === 0, evidence);
  });
}
