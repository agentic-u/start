// @effect-diagnostics nodeBuiltinImport:off asyncFunction:off -- This Node storage adapter owns hardlink installation and atomic filesystem selection replacement.
import { createHash, randomUUID } from "node:crypto";
import {
  link,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { Predicate } from "effect";

export const digest = (text: string): string =>
  createHash("sha256").update(text).digest("hex");

export const readSelection = (directory: string, id: string): Promise<string> =>
  readFile(path.join(directory, "selections", `${digest(id)}.json`), "utf-8");

export const readPackage = (directory: string, hash: string): Promise<string> =>
  readFile(path.join(directory, "packages", `${hash}.json`), "utf-8");

export const installPackage = async (
  directory: string,
  id: string,
  bytes: string,
  hash: string
): Promise<void> => {
  await mkdir(path.join(directory, "packages"), { recursive: true });
  await mkdir(path.join(directory, "selections"), { recursive: true });

  const temporary = path.join(
    directory,
    "packages",
    `${hash}.${randomUUID()}.tmp`
  );

  await writeFile(temporary, bytes, { flag: "wx" });

  try {
    await link(temporary, path.join(directory, "packages", `${hash}.json`));
  } catch (error) {
    if (!Predicate.hasProperty(error, "code") || error.code !== "EEXIST") {
      throw error;
    }

    const existing = await readPackage(directory, hash);

    if (existing !== bytes) {
      throw new Error("Immutable bundle package is corrupt.", { cause: error });
    }
  } finally {
    await unlink(temporary);
  }

  const reference = path.join(
    directory,
    "selections",
    `${digest(id)}.${randomUUID()}.tmp`
  );

  await writeFile(reference, JSON.stringify({ digest: hash }), { flag: "wx" });
  await rename(
    reference,
    path.join(directory, "selections", `${digest(id)}.json`)
  );
};
