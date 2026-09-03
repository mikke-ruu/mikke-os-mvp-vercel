import assert from "node:assert/strict";
import {
  MIKKE_MENU_PREFERENCES_RPC,
  menuPreferenceReplaceArguments,
  menuPreferenceRowsFromDraft,
  normalizeMikkeMenuPreferenceRows,
  projectMikkeMenuPreferences,
  shouldIncludeGuestMarketNoteData
} from "../lib/mikkeos/menu-preferences-model.ts";

assert.deepEqual(MIKKE_MENU_PREFERENCES_RPC, {
  getMine: "mikke_app_menu_preferences_get_mine",
  replaceMine: "mikke_app_menu_preferences_replace_mine",
  replaceItemsArgument: "p_items",
  resetMine: "mikke_app_menu_preferences_reset_mine"
});

const reordered = projectMikkeMenuPreferences(
  ["marketnote", "story", "community"],
  [
    { app_key: "story", sort_order: 0, is_hidden: false },
    { app_key: "marketnote", sort_order: 1, is_hidden: true }
  ]
);
assert.deepEqual(reordered.ownedAppKeys, ["story", "marketnote", "community"]);
assert.deepEqual(reordered.visibleOwnedAppKeys, ["story", "community"]);
assert.deepEqual(reordered.hiddenOwnedAppKeys, ["marketnote"]);

const fallback = projectMikkeMenuPreferences(["community", "marketnote", "story"], undefined);
assert.deepEqual(fallback.visibleOwnedAppKeys, ["marketnote", "story", "community"]);
assert.deepEqual(fallback.hiddenOwnedAppKeys, []);

const ignoresUnknownAndNonOwned = projectMikkeMenuPreferences(
  ["story"],
  [
    { app_key: "unknown", sort_order: 0, is_hidden: true },
    { app_key: "marketnote", sort_order: 0, is_hidden: false },
    { app_key: "story", sort_order: 1, is_hidden: false }
  ]
);
assert.deepEqual(ignoresUnknownAndNonOwned.visibleOwnedAppKeys, ["story"]);

const normalized = normalizeMikkeMenuPreferenceRows([
  { app_key: "story", sort_order: -2.8, is_hidden: false },
  { app_key: "story", sort_order: 4, is_hidden: true },
  { app_key: "marketnote", sort_order: "0", is_hidden: false }
]);
assert.deepEqual(normalized, [{ app_key: "story", sort_order: 4, is_hidden: true }]);

const rows = menuPreferenceRowsFromDraft({
  orderedAppKeys: ["story", "story", "marketnote"],
  hiddenAppKeys: ["marketnote"]
});
assert.deepEqual(rows, [
  { app_key: "story", sort_order: 0, is_hidden: false },
  { app_key: "marketnote", sort_order: 1, is_hidden: true }
]);
assert.deepEqual(menuPreferenceReplaceArguments(rows), { p_items: rows });

assert.equal(shouldIncludeGuestMarketNoteData(true, true), true);
assert.equal(shouldIncludeGuestMarketNoteData(true, false), false);
assert.equal(shouldIncludeGuestMarketNoteData(false, true), false);

console.log("mikke menu preference model: ok");
