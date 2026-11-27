import {
  cpSync,
  globSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";

const root = import.meta.dirname;

rmSync(path.join(root, "dist"), { recursive: true, force: true });

const files = [
  "config.ts",
  "typescript.ts",
  ...globSync("plugins/**/*", {
    cwd: root,
    exclude: ["**/*.test.ts", "**/*.d.ts"],
  }),
];

for (const file of files) {
  const source = path.join(root, file);

  if (!statSync(source).isFile()) {
    continue;
  }
  const destination = path.join(root, "dist", file.replace(/\.ts$/u, ".js"));

  mkdirSync(path.dirname(destination), { recursive: true });

  if (file.endsWith(".ts")) {
    const javascript = stripTypeScriptTypes(readFileSync(source, "utf-8"), {
      mode: "strip",
    }).replaceAll(
      /(?<prefix>from\s+|import\s*)(?<quote>["'])(?<module>\.{1,2}\/[^"']+)\.ts\k<quote>/gu,
      (...args) => {
        const groups = args.at(-1);

        return `${groups.prefix}${groups.quote}${groups.module}.js${groups.quote}`;
      }
    );

    writeFileSync(destination, javascript);
  } else {
    cpSync(source, destination, { recursive: true });
  }
}

cpSync(
  path.join(root, "effect-tsconfig.json"),
  path.join(root, "dist/effect-tsconfig.json")
);
