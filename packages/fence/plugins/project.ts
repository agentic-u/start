// @effect-diagnostics nodeBuiltinImport:off -- Lint tooling resolves caller-owned source filenames without reading application data.
import { existsSync, realpathSync } from "node:fs";
// @effect-diagnostics nodeBuiltinImport:off -- Caller paths must use the same physical root across symlink aliases such as /tmp on macOS.
import path from "node:path";

import type { Context } from "@oxlint/plugins";
import { Schema } from "effect";

const Paths = Schema.Array(Schema.String);

export const Project = Schema.Struct({
  runtimeRoots: Paths,
  browserFiles: Paths,
  browserRoots: Paths,
  viewRoots: Paths,
  buildFiles: Paths,
});

export type ProjectLayout = typeof Project.Type;

export const defaultLayout: ProjectLayout = {
  runtimeRoots: [],
  browserFiles: [],
  browserRoots: [],
  viewRoots: [],
  buildFiles: [],
};

const decodeLayout = Schema.decodeUnknownSync(Project, {
  onExcessProperty: "error",
});

export const projectLayout = (context: Context): ProjectLayout =>
  context.settings.agenticU === undefined
    ? defaultLayout
    : decodeLayout(context.settings.agenticU);

export const sourcePath = (filename: string, cwd: string): string => {
  const absolute = path.resolve(cwd, filename);
  const physical = existsSync(absolute) ? realpathSync(absolute) : absolute;
  const relative = path
    .relative(realpathSync(cwd), physical)
    .split(path.sep)
    .join("/");
  const match = /(?:^|\/)(?<workspace>(?:apps|packages)\/.+)$/u.exec(relative);

  return match?.groups?.workspace ?? relative;
};

export const within = (filename: string, directory: string): boolean =>
  filename === directory || filename.startsWith(`${directory}/`);

export const isRuntime = (filename: string, layout: ProjectLayout): boolean =>
  /^(?:apps|packages)\/[^/]+\/src\/.+/u.test(filename) ||
  layout.runtimeRoots.some((root) => within(filename, root));

export const isBrowserFile = (
  filename: string,
  layout: ProjectLayout
): boolean =>
  layout.browserFiles.includes(filename) ||
  layout.browserRoots.some((root) => within(filename, root));

export const isView = (filename: string, layout: ProjectLayout): boolean =>
  layout.viewRoots.some((root) => within(filename, root));
