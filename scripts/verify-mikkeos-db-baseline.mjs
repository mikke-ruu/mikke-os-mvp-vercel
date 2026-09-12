import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const baselineDir = path.join(root, "supabase", "baseline");
const schemaFile = path.join(
  baselineDir,
  "20260829000000_mikkeos_schema_baseline.sql",
);
const scaffoldOnly = process.argv.includes("--scaffold");

const failures = [];
const required = [
  "README.md",
  "production-catalog-manifest.json",
  "pre-cutover-migrations-manifest.json",
  "history-cutover-plan.md",
];

for (const name of required) {
  try {
    await access(path.join(baselineDir, name));
  } catch {
    failures.push(`missing required scaffold file: ${name}`);
  }
}

const manifest = JSON.parse(
  await readFile(
    path.join(baselineDir, "pre-cutover-migrations-manifest.json"),
    "utf8",
  ),
);
const migrationNames = (await readdir(path.join(root, "supabase", "migrations")))
  .filter((name) => /^\d{14}_.+\.sql$/.test(name))
  .sort();

if (manifest.state !== "prepared-not-archived") {
  failures.push("pre-cutover manifest must remain prepared-not-archived");
}
if (manifest.migrationCount !== migrationNames.length) {
  failures.push("migration count does not match the active directory");
}
if ((manifest.duplicateVersions ?? []).length > 0) {
  failures.push("duplicate migration versions exist");
}

for (const item of manifest.migrations ?? []) {
  const bytes = await readFile(path.join(root, "supabase", "migrations", item.file));
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== item.sha256) {
    failures.push(`checksum mismatch: ${item.file}`);
  }
}

if (!scaffoldOnly) {
  let sql = "";
  try {
    sql = await readFile(schemaFile, "utf8");
  } catch {
    failures.push("schema baseline is absent; authenticated read-only dump required");
  }

  if (sql) {
    const forbidden = [
      [/^\s*COPY\s+/gim, "COPY data statement"],
      [/^INSERT INTO\s+/gm, "top-level pg_dump data insert"],
      [/SUPABASE_(?:ACCESS_TOKEN|DB_PASSWORD|SERVICE_ROLE_KEY)/gi, "secret variable name"],
      [/postgres(?:ql)?:\/\/[^\s;]+/gi, "database connection string"],
      [/\bOWNER\s+TO\b/gi, "production role ownership"],
      [/-----BEGIN [A-Z ]*PRIVATE KEY-----/gi, "private key"],
      [/\bCREATE\s+ROLE\b/gi, "role creation"],
      [/\bALTER\s+ROLE\b[\s\S]{0,200}\bPASSWORD\b/gi, "role password"],
      [/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g, "JWT-like literal"],
    ];
    for (const [pattern, label] of forbidden) {
      if (pattern.test(sql)) failures.push(`forbidden baseline content: ${label}`);
    }

    for (const schema of ["public", "private", "community_private"]) {
      if (!new RegExp(`(?:CREATE\\s+SCHEMA|${schema}\\.)`, "i").test(sql)) {
        failures.push(`covered schema is absent from baseline: ${schema}`);
      }
    }

    const requiredSessionSettings = [
      /SET statement_timeout = '180s';/,
      /SET lock_timeout = '5s';/,
      /SET idle_in_transaction_session_timeout = '240s';/,
      /SET search_path = "\$user", public, extensions;\s*SET row_security = on;\s*$/,
    ];
    for (const pattern of requiredSessionSettings) {
      if (!pattern.test(sql)) {
        failures.push(`required baseline session setting is absent: ${pattern}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Baseline verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    scaffoldOnly
      ? `Baseline scaffold verified (${manifest.migrationCount} migrations; no files moved).`
      : "Schema baseline passed local safety checks.",
  );
}
