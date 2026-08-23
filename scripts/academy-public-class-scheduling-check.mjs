import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migration = readFileSync(join(root, "supabase/migrations/20260823233441_academy_public_class_scheduling.sql"), "utf8");
const lp = readFileSync(join(root, "lib/academy/lp.ts"), "utf8");
const publicPage = readFileSync(join(root, "app/academy/c/[id]/page.tsx"), "utf8");
const applyPage = readFileSync(join(root, "app/academy/apply/[id]/page.tsx"), "utf8");
const intake = readFileSync(join(root, "supabase/functions/academy-application-intake/index.ts"), "utf8");

assert.match(migration, /add column if not exists class_id uuid/);
assert.match(migration, /academy_list_public_classes/);
assert.match(migration, /academy_submit_public_class_application/);
assert.match(migration, /for update/);
assert.match(migration, /academy_class_capacity_reached/);
assert.doesNotMatch(migration.match(/academy_list_public_classes[\s\S]*?\$\$;/)?.[0] ?? "", /meeting_url/);
assert.match(lp, /listPublicClasses/);
assert.match(publicPage, /開催日程を見る/);
assert.match(publicPage, /この日程で申し込む/);
assert.match(applyPage, /name="academy-class"/);
assert.match(applyPage, /classId: selectedClass\?\.id \?\? null/);
assert.match(intake, /academy_submit_public_class_application/);

console.log("Academy public class scheduling contract: OK");
