import assert from "node:assert/strict";
import { getManagerHistorySourceLabel } from "../lib/manager/history-labels.ts";

const hiddenSourceLabels = {
  academy: "Academy",
  community: "Community",
  event: "Event",
  fund: "Fund",
  item_studio: "Item Studio",
  library: "Library",
  order: "Order",
  page: "Page",
  session: "Session",
  story: "Story",
  studio: "Item Studio",
  team_works: "Team Works"
};

for (const [sourceService, unpublishedLabel] of Object.entries(hiddenSourceLabels)) {
  const label = getManagerHistorySourceLabel(sourceService);
  assert.equal(label, "mikkeOS", `${sourceService} must use the safe fallback label`);
  assert.notEqual(label, unpublishedLabel, `${unpublishedLabel} must not appear as a history source label`);
}

assert.equal(getManagerHistorySourceLabel("marketnote"), "MarketNote");
assert.equal(getManagerHistorySourceLabel("market_note"), "MarketNote");
assert.equal(getManagerHistorySourceLabel("unknown_service"), "mikkeOS");
assert.equal(getManagerHistorySourceLabel(" TEAM_WORKS "), "mikkeOS");

console.log("manager history source labels: ok");
