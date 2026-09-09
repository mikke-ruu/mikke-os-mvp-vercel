import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MEMORY_LIMIT_MB = "6144";
const existingNodeOptions = process.env.NODE_OPTIONS?.trim();
const heapOption = `--max-old-space-size=${MEMORY_LIMIT_MB}`;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const preloadPath = path.join(scriptDirectory, "next-static-worker-memory.cjs");
const preloadOption = `--require=${JSON.stringify(preloadPath)}`;
const requiredNodeOptions = `${heapOption} ${preloadOption}`;

const result = spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build", "--webpack"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: existingNodeOptions
        ? `${existingNodeOptions} ${requiredNodeOptions}`
        : requiredNodeOptions,
    },
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
