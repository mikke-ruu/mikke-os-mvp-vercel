import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260825062848_academy_secure_video_asset_foundation.sql", import.meta.url),
  "utf8"
);
const types = readFileSync(new URL("../types/database.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("../lib/academy/video-assets.ts", import.meta.url), "utf8");

assert.match(migration, /create table public\.academy_video_assets/);
assert.match(migration, /revoke all on table public\.academy_video_assets from public, anon, authenticated/);
assert.match(migration, /provider_asset_id is never directly selectable|provider asset IDs are never directly selectable/i);
assert.match(migration, /private\.academy_can_manage_course_video/);
assert.match(migration, /in \('owner', 'administrator', 'course_editor'\)/);
assert.match(migration, /academy_program_step_video_course_mismatch/);
assert.match(migration, /\(step_type = 'video'\) = \(video_asset_id is not null\)/);
assert.doesNotMatch(migration, /create policy[^;]+learner[^;]+academy_video_assets/is);
assert.match(types, /export type AcademyVideoAsset/);
assert.match(client, /\.from\("academy_video_assets"\)/);
assert.match(client, /assertAcademyWritable\(\)/);

console.log("Academy secure video foundation contract: OK");
