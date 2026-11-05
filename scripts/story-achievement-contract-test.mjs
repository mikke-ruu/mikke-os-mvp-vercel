import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const sources = [
  source("occurrence-1", "market", "activity_log"),
  source("occurrence-1", "market", "story_snapshot", "card_and_count"),
  source("occurrence-2", "market", "activity_log"),
  source("occurrence-3", "market", "activity_log"),
  source("occurrence-3", "market", "story_snapshot", "card_only"),
  source("occurrence-4", "production", "activity_log"),
  source("occurrence-4", "production", "story_snapshot", "count_only"),
  source("occurrence-today", "market", "activity_log", undefined, "confirmed", "2026-08-16", "2026-08-15"),
  source("occurrence-unconfirmed", "market", "activity_log", undefined, "planned", "2026-08-15", "2026-08-14")
];

const todayJst = "2026-08-16";

const publishedSnapshots = sources.filter(
  (item) => item.source === "story_snapshot" && item.publicationStatus === "published"
);
const explicitOccurrenceKeys = new Set(publishedSnapshots.map(occurrenceKey));
const automaticSources = sources.filter(
  (item) =>
    item.source === "activity_log" &&
    item.sourceService === "marketnote" &&
    item.status === "confirmed" &&
    item.endedAt < todayJst &&
    !explicitOccurrenceKeys.has(occurrenceKey(item))
);
const manualCountSources = publishedSnapshots.filter(
  (item) => item.displayMode === "count_only" || item.displayMode === "card_and_count"
);
const distinct = new Map();

for (const item of [...automaticSources, ...manualCountSources]) {
  distinct.set(metricOccurrenceKey(item), item);
}

const counts = new Map();
for (const item of distinct.values()) {
  counts.set(item.metricKey, (counts.get(item.metricKey) ?? 0) + 1);
}

assert.equal(sources.length, 9, "fixture source rows");
assert.equal(new Set(sources.filter((item) => item.source === "activity_log").map(occurrenceKey)).size, 6);
assert.equal(distinct.size, 3, "same occurrence must be counted only once");
assert.equal(counts.get("market"), 2, "card_only must suppress the automatic count override");
assert.equal(counts.get("production"), 1, "count_only must add one aggregate count");
assert.equal(
  automaticSources.some((item) => item.sourceRecordId === "occurrence-today"),
  false,
  "ended_at on the current JST date must not count even when occurred_at is earlier"
);
assert.equal(
  automaticSources.some((item) => item.sourceRecordId === "occurrence-unconfirmed"),
  false,
  "only confirmed Activity Log sources are eligible"
);
assert.equal(
  publishedSnapshots.filter((item) => item.displayMode === "card_only" || item.displayMode === "card_and_count").length,
  2,
  "only card modes create public cards"
);
assert.notEqual(
  occurrenceKey(sources[0]),
  occurrenceKey(sources[2]),
  "two occurrences in the same recurring series require different source_record_id values"
);

const migrationPath = new URL("../supabase/migrations/20260816073406_story_achievement_rpc_design.sql", import.meta.url);
const migrationSql = readFileSync(migrationPath, "utf8");
const publishBlock = functionBlock("story_achievement_publish_mine");
const listBlock = functionBlock("story_achievement_list_mine");
const updateBlock = functionBlock("story_achievement_update_draft_mine");
const settingsBlock = functionBlock("story_achievement_metric_settings_save_mine");

assert.match(publishBlock, /al\.source_service = 'marketnote'/);
assert.match(publishBlock, /al\.status = 'confirmed'/);
assert.match(publishBlock, /al\.ended_at < \(now\(\) at time zone 'Asia\/Tokyo'\)::date/);
assert.equal((migrationSql.match(/where sa\.published_at is not null/g) ?? []).length, 2);
assert.doesNotMatch(migrationSql, /create policy story_achievements_update_owner/);
assert.match(settingsBlock, /for update of sp;[\s\S]*delete from public\.story_achievement_metric_settings/);
assert.match(migrationSql, /create function public\.story_achievement_withdraw_mine\(p_achievement_id uuid\)/);
assertNarrowOwnerResult(listBlock, "list");
assertNarrowOwnerResult(publishBlock, "publish");
assertNarrowOwnerResult(updateBlock, "update");
assert.equal(existsSync(new URL("../app/story/achievements/preview/page.tsx", import.meta.url)), false);
assert.equal(existsSync(new URL("../app/story/achievements/page.tsx", import.meta.url)), true);

console.log("STORY achievement contract test passed");

function source(
  sourceRecordId,
  metricKey,
  sourceType,
  displayMode,
  status = "confirmed",
  endedAt = "2026-08-15",
  occurredAt = "2026-08-15"
) {
  return {
    storyProfileId: "story-test",
    sourceService: "marketnote",
    sourceRecordId,
    metricKey,
    source: sourceType,
    displayMode,
    status,
    endedAt,
    occurredAt,
    publicationStatus: sourceType === "story_snapshot" ? "published" : undefined
  };
}

function occurrenceKey(item) {
  return [item.storyProfileId, item.sourceService, item.sourceRecordId].join("|");
}

function metricOccurrenceKey(item) {
  return [occurrenceKey(item), item.metricKey].join("|");
}

function functionBlock(name) {
  const pattern = new RegExp(`create function public\\.${name}[\\s\\S]*?revoke all on function public\\.${name}`, "m");
  const match = migrationSql.match(pattern);
  assert.ok(match, `${name} must exist exactly once`);
  assert.equal((migrationSql.match(new RegExp(`create function public\\.${name}`, "g")) ?? []).length, 1);
  return match[0];
}

function assertNarrowOwnerResult(block, label) {
  const returns = block.match(/returns table \(([\s\S]*?)\)\r?\n(?:language|$)/)?.[1] ?? "";
  assert.match(returns, /achievement_id uuid/);
  assert.match(returns, /display_mode text/);
  assert.match(returns, /publication_status text/);
  assert.doesNotMatch(returns, /source_record_id|metric_key|public_note|public_photo_storage_path/,
    `${label} RPC must not return source or private fields`);
}
