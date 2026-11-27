import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const args = process.argv.slice(2);

if (args.length !== 0 && (args.length !== 2 || args[0] !== "--out")) {
  throw new Error("usage: node scripts/pack-runtime.mjs [--out DIRECTORY]");
}

const output =
  args.length === 0
    ? mkdtempSync(path.join(tmpdir(), "agenticu-release-"))
    : path.resolve(args[1]);

if (existsSync(output)) {
  if (readdirSync(output).length !== 0) {
    throw new Error(`release directory must be empty: ${output}`);
  }
} else {
  mkdirSync(output, { recursive: true });
}

const release = "0.1.0";

const names = [
  "bundles",
  "catalog",
  "cli",
  "house",
  "jobs",
  "local",
  "operations",
  "participation",
  "progress",
];

const packages = names.map((name) => {
  const packed = spawnSync("pnpm", ["pack", "--pack-destination", output], {
    cwd: path.join(root, "packages", name),
    encoding: "utf-8",
  });

  if (packed.error) {
    throw packed.error;
  }

  if (packed.status !== 0) {
    throw new Error(
      `packing ${name} failed: ${packed.stderr}\n${packed.stdout}`
    );
  }

  const file = `agentic-u-${name}-${release}.tgz`;

  const artifact = path.join(output, file);

  const sha256 = createHash("sha256")
    .update(readFileSync(artifact))
    .digest("hex");

  chmodSync(artifact, 0o444);

  return { file, sha256 };
});

const manifest = path.join(output, "manifest.json");

const dependencies = Object.fromEntries(
  names.map((name) => [
    `@agentic-u/${name}`,
    `file:agentic-u-${name}-${release}.tgz`,
  ])
);

writeFileSync(
  path.join(output, "package.json"),
  `${JSON.stringify({ name: "agenticu-runtime-release", version: release, private: true, dependencies }, null, 2)}\n`,
  { flag: "wx" }
);

const locked = spawnSync(
  "npm",
  [
    "install",
    "--package-lock-only",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--omit=dev",
  ],
  { cwd: output, encoding: "utf-8" }
);

if (locked.error) {
  throw locked.error;
}

if (locked.status !== 0) {
  throw new Error(
    `locking runtime distribution failed: ${locked.stderr}\n${locked.stdout}`
  );
}

const installFiles = ["package.json", "package-lock.json"].map((file) => {
  const artifact = path.join(output, file);

  const sha256 = createHash("sha256")
    .update(readFileSync(artifact))
    .digest("hex");

  chmodSync(artifact, 0o444);

  return { file, sha256 };
});

writeFileSync(
  manifest,
  `${JSON.stringify({ schemaVersion: 1, release, packages, installFiles }, null, 2)}\n`,
  {
    flag: "wx",
    mode: 0o444,
  }
);

process.stdout.write(`${output}\n`);
