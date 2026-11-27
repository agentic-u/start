import { operations as publicOperations } from "@agentic-u/catalog";
import { houseOperations } from "@agentic-u/house";
import { jobOperations } from "@agentic-u/jobs/operations";
import {
  layerSubprocess,
  toCodeMode,
  toExecuteCapability,
} from "@agentic-u/operations";

export const sandboxLimits = { maxToolCalls: 32, maxOutputBytes: 262_144 };

export const SandboxLive = layerSubprocess({
  ...sandboxLimits,
  timeout: "5 seconds",
});

export const execute = toExecuteCapability(
  publicOperations,
  sandboxLimits
).capability;

export const codeMode = toCodeMode(publicOperations, sandboxLimits);

export const operations = [
  ...publicOperations,
  ...houseOperations,
  ...jobOperations,
  execute,
] as const;
