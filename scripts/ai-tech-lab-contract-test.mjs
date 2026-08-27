import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  migration: "supabase/migrations/20260827140922_ai_tech_lab_mvp.sql",
  databaseTest: "supabase/tests/ai_tech_lab_rls.sql",
  component: "components/hq/AiTechLabPage.tsx",
  library: "lib/ai-tech-lab.ts",
  shell: "components/hq/HqShell.tsx"
};

const contents = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, relativePath]) => [
  key,
  await readFile(path.join(root, relativePath), "utf8")
])));

const checks = [
  ["six LAB tables", (contents.migration.match(/create table public\.mikkeos_ai_tech_/g) ?? []).length === 6],
  ["RLS enabled on every LAB table", (contents.migration.match(/enable row level security/g) ?? []).length === 6],
  ["approval RPC uses SECURITY DEFINER", /mikkeos_ai_tech_approve_for_lab[\s\S]+security definer[\s\S]+set search_path = ''/.test(contents.migration)],
  ["decision RPC uses SECURITY DEFINER", /mikkeos_ai_tech_decide_experiment[\s\S]+security definer[\s\S]+set search_path = ''/.test(contents.migration)],
  ["browser writes are revoked", /revoke all on public\.%I from public, anon, authenticated/.test(contents.migration)],
  ["raw collection metadata is not granted to browsers", /grant select \(id, source_id, title, summary,[\s\S]+on public\.mikkeos_ai_tech_news to authenticated/.test(contents.migration) && !/grant select on public\.mikkeos_ai_tech_news to authenticated/.test(contents.migration)],
  ["service role can run ingestion without destructive privileges", /grant select, insert, update on[\s\S]+to service_role/.test(contents.migration) && /revoke delete, truncate, references, trigger on[\s\S]+from service_role/.test(contents.migration)],
  ["foreign-key lookup indexes are present", ["experiments_implementation_item_idx", "experiments_approved_by_idx", "experiments_decided_by_idx", "adoptions_adopted_by_idx"].every((name) => contents.migration.includes(name))],
  ["three official sources are seeded", ["openai-news", "google-ai-developers", "github-changelog"].every((key) => contents.migration.includes(key))],
  ["four screens are represented", ["news", "for-mikkeos", "lab", "adopted"].every((mode) => contents.component.includes(`mode: \"${mode}\"`) || contents.component.includes(`mode === \"${mode}\"`))],
  ["approved user wording is present", contents.component.includes("mikkeOSで活用できるもの")],
  ["old wording is absent", !contents.component.includes("mikkeOSへの影響が大きいもの")],
  ["HQ navigation includes LAB", contents.shell.includes("AI TECH LAB")],
  ["client calls narrow RPCs", contents.library.includes("mikkeos_ai_tech_approve_for_lab") && contents.library.includes("mikkeos_ai_tech_decide_experiment")],
  ["database test is rollback-only", contents.databaseTest.includes("set local lock_timeout = '3s'") && contents.databaseTest.trimEnd().endsWith("rollback;")]
];

const failed = checks.filter(([, passed]) => !passed);
for (const [label, passed] of checks) process.stdout.write(`${passed ? "PASS" : "FAIL"} ${label}\n`);
if (failed.length) process.exitCode = 1;
