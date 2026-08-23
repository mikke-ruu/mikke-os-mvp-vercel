import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../supabase/migrations/20260823223416_academy_learner_portal_context.sql", import.meta.url), "utf8");
const accessContext = readFileSync(new URL("../lib/academy/access-context.ts", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/academy/AcademyShell.tsx", import.meta.url), "utf8");
const portal = readFileSync(new URL("../app/academy/portal/page.tsx", import.meta.url), "utf8");
const study = readFileSync(new URL("../app/academy/portal/study/page.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../components/academy/AcademyCourseWorkspace.tsx", import.meta.url), "utf8");

assert.match(migration, /create table if not exists public\.academy_learner_pages/);
assert.match(migration, /private\.academy_is_course_learner/);
assert.match(migration, /application\.user_id = p_user_id/);
assert.match(migration, /application\.status in \(/);
assert.match(migration, /is_published = true[\s\S]*academy_is_course_learner/);
assert.match(migration, /academy:learner_portal:view/);
assert.match(migration, /academy:instructor_portal:view/);
assert.match(migration, /academy:instructor:operate/);
assert.match(migration, /registration_status = 'registered'/);
assert.match(migration, /is_certified = true/);
assert.match(migration, /materials read manager or registered instructor/);
assert.match(accessContext, /roles: \["owner", "instructor", "learner"\]/);
assert.match(shell, /canShowPersonalHref/);
assert.match(shell, /personalView === "learner"/);
assert.match(portal, /showViewSwitch/);
assert.match(portal, /hasLearnerView && hasInstructorView/);
assert.match(portal, /受講者用/);
assert.match(portal, /認定講師用/);
assert.match(study, /getLearnerPageForViewer/);
assert.match(study, /本部が復習ページを準備中です/);
assert.match(workspace, /label: "復習ページ"/);
assert.match(workspace, /label: "講師用資料ページ"/);

console.log("Academy personal portal contract: OK");
