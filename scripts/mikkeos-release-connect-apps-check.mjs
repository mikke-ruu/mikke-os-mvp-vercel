import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ownedApps = readFileSync(new URL("../components/mikkeos/useOwnedMikkeApps.ts", import.meta.url), "utf8");
const releasedApps = readFileSync(new URL("../lib/mikkeos/released-apps.ts", import.meta.url), "utf8");

for (const expected of [
  'academy: { name: "Academy", helper: "講座の作成・運営・受講を始められます", href: "/academy" }',
  'community: { name: "Community", helper: "お知らせ・質問・会話・予定をRoomに分けて交流できます", href: "/community" }',
  'supabase.rpc("academy_list_my_contexts")',
  'next.add("academy")',
  '["marketnote", "story", "academy", "community"]'
]) {
  assert.ok(ownedApps.includes(expected), `missing connect-app contract: ${expected}`);
}

assert.match(releasedApps, /academyApp: MikkeOwnerMenuItem = \{ title: "Academy", href: "\/academy", icon: GraduationCap, tone: "pink" \}/);
assert.match(releasedApps, /releasedApps: MikkeOwnerMenuItem\[\] = \[marketNoteApp, storyApp, academyApp, communityApp\]/);
assert.doesNotMatch(ownedApps, /Community と認定講座サイト管理は一般公開していない/);

console.log("mikkeOS Academy/Community connect-app release contract: OK");
