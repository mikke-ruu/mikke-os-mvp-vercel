import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const helperSource = readFileSync("lib/community/error-message.ts", "utf8");
const { outputText } = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
});
const helperModule = { exports: {} };
Function("module", "exports", outputText)(helperModule, helperModule.exports);
const { communityErrorMessage } = helperModule.exports;

assert.equal(
  communityErrorMessage({ message: "COMMUNITY_PLATFORM_OWNER_READ_ONLY" }, "fallback"),
  "現在の契約状態では、新しいCommunityを作成できません。利用プラン・契約状態を確認してください。"
);
assert.match(communityErrorMessage({ code: "42501", message: "PLATFORM_BILLING_FORBIDDEN" }, "fallback"), /権限/);
assert.match(communityErrorMessage({ message: "Failed to fetch private endpoint" }, "fallback"), /通信/);
assert.match(communityErrorMessage({ message: "PLATFORM_BILLING_EXPIRED" }, "fallback"), /利用期間が終了/);
assert.equal(communityErrorMessage({ message: "secret_internal_code" }, "安全な案内"), "安全な案内");
assert.equal(communityErrorMessage({ message: "入力内容を確認してください。" }, "fallback"), "入力内容を確認してください。");

const hub = readFileSync("components/community/CommunityHub.tsx", "utf8");
assert.match(hub, /loadCommunityPlatformStatus\(null,/);
assert.match(hub, /<fieldset disabled=\{fieldsDisabled\}/);
assert.match(hub, /aria-describedby=\{createBlock \? "community-create-block" : undefined\}/);
assert.match(hub, /id="community-create-block" role="status" aria-live="polite"/);
assert.match(hub, /<button disabled=\{fieldsDisabled\}/);

console.log("community_create_japanese_block_ok");
