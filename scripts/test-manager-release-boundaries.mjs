import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canRenderManagerAccount } from "../lib/manager/account-boundary.ts";

assert.equal(canRenderManagerAccount("A", "A"), true);
assert.equal(canRenderManagerAccount("B", "A"), false);
assert.equal(canRenderManagerAccount("A", "B"), false);
assert.equal(canRenderManagerAccount(undefined, undefined), false);
assert.equal(canRenderManagerAccount("", ""), false);

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
for (const route of ["", "account/", "history/", "settings/", "notifications/", "personal-events/"]) {
  assert.match(read(`app/manager/${route}page.tsx`), /ManagerAuthGate/);
}
assert.match(read("components/manager/ManagerAuthGate.tsx"), /Fragment key=\{user.id\}/);
const snapshot = read("lib/manager/collect-manager-items.ts");
for (const source of ["fund", "team-works", "order", "session", "event", "item-studio"]) {
  assert.ok(!snapshot.includes(`./adapters/${source}"`), `unreleased source: ${source}`);
}
assert.match(snapshot, /useMarketNoteManagerBridge\(ownerProfileId\)/);
assert.match(snapshot, /useAcademyManagerBridge\(ownerUserId\)/);
assert.match(read("lib/manager/adapters/academy.ts"), /!userId \|\| isAcademyLocalReview\(\)/);

const owner = read("components/mikkeos/useOwnedMikkeApps.ts");
assert.match(owner, /academy_list_my_contexts/);
assert.match(owner, /shouldIncludeGuestMarketNoteData\(isGuest, hasGuestMarketNoteData\)/);
assert.match(owner, /projectMikkeMenuPreferences\(ownedKeysInStandardOrder, ownerMatches \? preferenceRows : \[\]\)/);
assert.match(owner, /detectedState && !isGuest && detectedState.ownerId === userId/);
assert.match(owner, /preferenceOwner === currentPreferenceOwner/);
const history = read("components/manager/ManagerHistoryList.tsx");
assert.match(history, /logState\?\.ownerId === user.id/);
assert.match(history, /最新30件/);
assert.doesNotMatch(history, /isManagerAchievement|過去の実績|HistoryTab/);
assert.match(read("components/manager/ManagerShell.tsx"), /suggestedApps=\{\[\]\}/);
assert.match(read("app/manager/calendar/page.tsx"), /\/marketnote\?from=manager/);
console.log("manager release static boundaries: ok (not Auth or browser E2E)");
