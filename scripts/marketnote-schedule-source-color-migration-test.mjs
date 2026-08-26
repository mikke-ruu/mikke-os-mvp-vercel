import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = readFileSync(join(root, "supabase/migrations/20260826144726_marketnote_schedule_source_display_color.sql"), "utf8");

assert.match(sql, /alter table public\.market_schedule_source_preferences/i);
assert.match(sql, /add column display_color text not null default '#9CCDB9'/i);
assert.match(sql, /market_schedule_source_preferences_display_color_check/i);
assert.match(sql, /display_color ~ '\^#\[0-9A-Fa-f\]\{6\}\$'/i);
assert.doesNotMatch(sql, /market_events|activity_logs|story_achievements|market_financial_records/i);

console.log("MarketNote schedule source color migration contract: ok");
