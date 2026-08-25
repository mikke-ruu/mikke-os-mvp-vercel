import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260825050958_academy_course_timed_learning_access.sql", import.meta.url),
  "utf8"
);
const form = readFileSync(new URL("../app/academy/courses/CourseForm.tsx", import.meta.url), "utf8");
const courseRepository = readFileSync(new URL("../lib/academy/courses.ts", import.meta.url), "utf8");
const portal = readFileSync(new URL("../app/academy/portal/study/page.tsx", import.meta.url), "utf8");
const accessRepository = readFileSync(new URL("../lib/academy/course-access.ts", import.meta.url), "utf8");

assert.match(migration, /learner_access_mode text not null default 'unlimited'/);
assert.match(migration, /days_after_payment/);
assert.match(migration, /days_after_enrollment/);
assert.match(migration, /days_after_completion/);
assert.match(migration, /fixed_end/);
assert.match(migration, /create table if not exists public\.academy_course_access_grants/);
assert.match(migration, /ends_at is null or ends_at > starts_at/);
assert.match(migration, /academy_course_access_grant_window_is_immutable/);
assert.match(migration, /on delete restrict/);
assert.doesNotMatch(migration, /policy[\s\S]{0,120}for delete/i);
assert.match(migration, /private\.academy_has_course_content_access/);
assert.match(
  migration,
  /p_user_id\s*=\s*\(select auth\.uid\(\)\)[\s\S]*grant execute on function private\.academy_has_course_content_access\(uuid, uuid\)\s+to authenticated/,
);
assert.match(
  migration,
  /grant execute on function private\.academy_can_manage_learner_access\(uuid\)\s+to authenticated/,
);
assert.match(migration, /access_grant\.starts_at <= now\(\)/);
assert.match(migration, /access_grant\.ends_at is null or access_grant\.ends_at > now\(\)/);
assert.match(migration, /academy_learner_pages_learner_select[\s\S]*academy_has_course_content_access/);
assert.match(migration, /academy_profile_has_program_access[\s\S]*academy_has_course_content_access/);
assert.match(migration, /Existing learners retain the access promised/);
assert.match(migration, /'legacy'/);
assert.match(migration, /on conflict \(application_id, source\) do nothing/);

assert.match(form, /教材を見られる期間/);
assert.match(form, /ステップ教材、復習ページ、受講者向け資料、動画にまとめて適用/);
assert.match(form, /認定講師用の資料は、講師登録・資格の状態で別に管理/);
assert.match(form, /learnerAccessDays/);
assert.match(form, /閲覧終了日時/);
assert.match(courseRepository, /learner_access_mode: input\.learnerAccessMode/);
assert.match(courseRepository, /new Date\(input\.learnerAccessFixedEndAt\)\.toISOString\(\)/);

assert.match(accessRepository, /academy_course_access_grants/);
assert.match(accessRepository, /resolveCourseAccessGrant/);
assert.match(portal, /教材の閲覧期間は終了しました/);
assert.match(portal, /修了・認定の履歴はそのまま残ります/);
assert.match(portal, /閲覧期限：期限なし/);

console.log("Academy timed learning access contract: OK");
