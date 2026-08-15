import { createHash, randomBytes } from "node:crypto";
import { chmod, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const sourceEnvPath = process.env.MIKKEOS_SOURCE_ENV || path.join(path.dirname(repoRoot), "mikke-os-mvp", ".env.local");
const targetEnvPath = path.join(repoRoot, ".env.dispatcher.local");

function parseEnv(source) {
  return Object.fromEntries(source.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    return match ? [[match[1], match[2]]] : [];
  }));
}

const source = parseEnv(await readFile(sourceEnvPath, "utf8"));
if (!source.NEXT_PUBLIC_SUPABASE_URL || !source.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が見つかりません。");
}

const workerSecret = randomBytes(48).toString("base64url");
const secretSha256 = createHash("sha256").update(workerSecret).digest("hex");
const runtimeDir = path.join(repoRoot, ".dispatcher");
await mkdir(runtimeDir, { recursive: true });
await writeFile(targetEnvPath, [
  `MIKKEOS_SUPABASE_URL=${source.NEXT_PUBLIC_SUPABASE_URL}`,
  `MIKKEOS_SUPABASE_ANON_KEY=${source.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
  `MIKKEOS_DISPATCHER_SECRET=${workerSecret}`,
  `MIKKEOS_REPO_ROOT=${repoRoot}`,
  "MIKKEOS_POLL_INTERVAL_MS=30000",
  "",
].join("\n"), { encoding: "utf8", mode: 0o600 });
await chmod(targetEnvPath, 0o600).catch(() => undefined);

const sourceAppEnv = path.join(path.dirname(repoRoot), "mikke-os-mvp", ".env.local");
await copyFile(sourceAppEnv, path.join(runtimeDir, "app.env.local")).catch(() => undefined);

process.stdout.write(JSON.stringify({ configured: true, secretSha256, targetEnvPath }));
