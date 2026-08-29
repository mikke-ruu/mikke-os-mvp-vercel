import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const client = readFileSync("lib/academy/community-links.ts", "utf8");
const settings = readFileSync("app/academy/settings/page.tsx", "utf8");

assert.match(client, /isCurrent: boolean/);
assert.match(client, /activeClaimCount: number/);
assert.match(client, /Revoke active Academy claims before changing or archiving this mapping/);
assert.match(client, /現在この連携を利用中の方がいるため/);
assert.match(client, /通常のCommunity会員資格・閲覧範囲・有料契約は変更されません/);

assert.match(settings, /mapping\.isCurrent/);
assert.match(settings, /mapping\.activeClaimCount/);
assert.match(settings, /mapping\.id === communityForm\.mappingId/);
assert.match(settings, /readOnly=\{Boolean\(currentCommunityMapping\)\}/);
assert.match(settings, /利用中（\$\{mapping\.activeClaimCount\}件）/);
assert.match(settings, /過去の接続/);
assert.match(settings, /連携を停止する/);
assert.match(settings, /communityLinkHasActiveClaims/);
assert.match(settings, /Academy由来の利用権を停止/);
assert.match(settings, /window\.confirm/);
assert.match(settings, /listMyAcademyCommunityLinkOptions\(headquarters\.id\)/);
assert.match(settings, /refreshedMapping\?\.activeClaimCount \?\? 0/);
assert.match(settings, /getAcademyCommunityClaimStopErrorMessage/);
assert.match(settings, /getAcademyCommunityLinkErrorMessage/);
assert.doesNotMatch(settings, /catch \{\s*setMessage\("Community連携を保存できませんでした/);

console.log("academy-community-connection-ui-check: ok");
