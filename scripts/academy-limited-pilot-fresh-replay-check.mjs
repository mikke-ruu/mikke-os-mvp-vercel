import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const runnerPath = fileURLToPath(new URL("./academy-limited-pilot-fresh-replay.mjs", import.meta.url));
const manifestPath = fileURLToPath(new URL("./academy-limited-pilot-replay-manifest.json", import.meta.url));
const runnerSource = readFileSync(runnerPath, "utf8");
const manifestSource = readFileSync(manifestPath, "utf8");
const run = spawnSync(process.execPath, [runnerPath], { encoding: "utf8" });
if (run.status !== 0) throw new Error(run.stderr || "static dry-run failed");
const result = JSON.parse(run.stdout);
if (result.databaseConnected !== false) throw new Error("static dry-run connected to a database");
if (result.sourceCount !== 17 || result.migrationCount !== 13 || result.testCount !== 4) throw new Error("source count mismatch");
if (!result.orderVerified || !result.blobVerified || !result.transactionSentinelsVerified) throw new Error("static verification incomplete");
if (/NEXT_PUBLIC_[A-Z_]*(SECRET|SERVICE_ROLE)/.test(`${runnerSource}\n${manifestSource}`)) throw new Error("public secret variable is forbidden");
if (!manifestSource.includes("fd0f00d2fedd471d5a6636252108bba2708c0948")) throw new Error("Academy source commit missing");
if (!manifestSource.includes("93325c566f806d021f841021204d8f4faf8ccd22")) throw new Error("Community source commit missing");
if (!runnerSource.includes("productionProjectRefDenylist")) throw new Error("production denylist is missing");
if (!runnerSource.includes("databaseUrlSha256") || !runnerSource.includes("new URL(databaseUrl)")) throw new Error("approved URL verification is missing");
if (!runnerSource.includes("JSON.stringify(manifest.sources) !== JSON.stringify(expectedSourceOrder)")) throw new Error("independent source order assertion is missing");
if (!runnerSource.includes("collectSnapshot") || !runnerSource.includes("compareSnapshots")) throw new Error("catalog snapshot comparison is missing");
for (const classification of ["relation", "column", "function", "index", "policy", "trigger", "history", "fixture"]) {
  if (!runnerSource.includes(classification)) throw new Error(`zero-residue classification missing: ${classification}`);
}
if (!runnerSource.includes("input: sql")) throw new Error("psql streaming input is missing");
if (/writeFileSync|rollback-only\.sql|mkdtempSync/.test(runnerSource)) throw new Error("SQL must not be copied to a temporary file");
if (/databaseUrl\.includes\(previewRef\)/.test(runnerSource)) throw new Error("substring URL allowlisting is forbidden");
if (!runnerSource.includes("preflightSnapshotSha256")) throw new Error("approved preflight snapshot is missing");
if (!runnerSource.includes("assertBaselineMetaCommands")) throw new Error("baseline meta-command allowlist is missing");
for (const forbiddenMeta of ["\\connect", "\\include", "\\ir", "\\!", "\\gexec", "\\o"]) {
  if (runnerSource.includes(`startsWith(${JSON.stringify(forbiddenMeta)})`)) throw new Error(`unsafe explicit meta-command path: ${forbiddenMeta}`);
}
for (const timeout of ["lock_timeout = '5s'", "statement_timeout = '180s'", "idle_in_transaction_session_timeout = '240s'"]) {
  if (!runnerSource.includes(timeout)) throw new Error(`runbook timeout missing: ${timeout}`);
}
if (!runnerSource.includes("expectedDeltaOrder") || !runnerSource.includes("delta rollback-only replay")) throw new Error("separate delta replay stage is missing");
if (!manifestSource.includes("fixtureIds") || !manifestSource.includes("a1000000-0000-4000-8000-000000000001") || !manifestSource.includes("a2000000-0000-4000-8000-000000000001") || !manifestSource.includes("a7000000-0000-4000-8000-000000000001")) {
  throw new Error("fixture identity manifest is incomplete");
}
process.stdout.write("Academy limited pilot static replay contract: OK\n");
