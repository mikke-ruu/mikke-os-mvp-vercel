import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migrationDir = path.join(root, "supabase", "migrations");
const output = path.join(
  root,
  "supabase",
  "baseline",
  "pre-cutover-migrations-manifest.json",
);

const names = (await readdir(migrationDir))
  .filter((name) => /^\d{14}_.+\.sql$/.test(name))
  .sort((left, right) => left.localeCompare(right));

const migrations = [];
for (const name of names) {
  const bytes = await readFile(path.join(migrationDir, name));
  migrations.push({
    version: name.slice(0, 14),
    file: name,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

const duplicateVersions = migrations
  .filter((item, index) =>
    migrations.findIndex((candidate) => candidate.version === item.version) !== index,
  )
  .map((item) => item.version);

const manifest = {
  generatedAt: new Date().toISOString(),
  state: "prepared-not-archived",
  sourceDirectory: "supabase/migrations",
  futureArchiveDirectory:
    "supabase/migrations_archive/pre_baseline/2026-08-29",
  migrationCount: migrations.length,
  firstVersion: migrations.at(0)?.version ?? null,
  lastVersion: migrations.at(-1)?.version ?? null,
  duplicateVersions: [...new Set(duplicateVersions)],
  migrations,
};

await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Wrote ${migrations.length} migration checksums to ${output}`);
