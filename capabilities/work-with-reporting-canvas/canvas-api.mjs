#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      file: { type: "string" },
      json: { type: "boolean" },
      server: { type: "string" },
    },
  });
  const [method, endpoint] = positionals;
  if (
    positionals.length !== 2 ||
    !["GET", "POST", "DELETE"].includes(method) ||
    !(endpoint === "/readme" || endpoint.startsWith("/api/")) ||
    endpoint.includes("://")
  ) {
    throw new Error(
      "usage: node canvas-api.mjs GET|POST|DELETE /readme|/api/PATH [--file BODY_FILE] [--json] [--server SERVER_JSON]"
    );
  }
  if (method === "GET" && values.file !== undefined)
    throw new Error("GET requests cannot carry a body file.");
  let configFile = values.server;
  if (configFile === undefined) {
    switch (process.platform) {
      case "darwin":
        configFile = path.join(
          homedir(),
          "Library/Application Support/tldraw/server.json"
        );
        break;
      case "linux":
        configFile = path.join(
          process.env.XDG_CONFIG_HOME ?? path.join(homedir(), ".config"),
          "tldraw/server.json"
        );
        break;
      case "win32":
        if (process.env.APPDATA === undefined)
          throw new Error(
            "APPDATA unavailable; select the app server.json with --server."
          );
        configFile = path.join(process.env.APPDATA, "tldraw/server.json");
        break;
      default:
        throw new Error(
          "Unsupported platform; select the app server.json with --server."
        );
    }
  }
  const configText = await readFile(configFile, "utf8");
  let server;
  try {
    server = JSON.parse(configText);
  } catch (cause) {
    throw new Error(
      "Invalid tldraw discovery JSON; reopen the app or select its current server.json.",
      { cause }
    );
  }
  if (
    server === null ||
    typeof server !== "object" ||
    !Number.isInteger(server.port) ||
    server.port < 1 ||
    server.port > 65535 ||
    typeof server.token !== "string" ||
    server.token.length === 0
  ) {
    throw new Error(
      "Invalid tldraw server discovery record; open the app and use its current server.json."
    );
  }
  const headers = { authorization: "Bearer " + server.token };
  const body =
    values.file === undefined ? undefined : await readFile(values.file, "utf8");
  if (body !== undefined)
    headers["content-type"] = values.json ? "application/json" : "text/plain";
  const response = await fetch(`http://127.0.0.1:${server.port}${endpoint}`, {
    method,
    headers,
    body,
  });
  const output = await response.text();
  process.stdout.write(output + (output.endsWith("\n") ? "" : "\n"));
  if (!response.ok) process.exitCode = 1;
}

main().catch((error) => {
  // Discovery JSON can contain the token; keep parser excerpts/causes out of output.
  console.error(error.message);
  process.exitCode = 1;
});
