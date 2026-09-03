import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const success = read("app/billing/success/page.tsx");
const cancel = read("app/billing/cancel/page.tsx");
const card = read("components/billing/PlatformBillingReturnCard.tsx");

for (const [source, canonical] of [[success, "/billing/success"], [cancel, "/billing/cancel"]]) {
  assert.match(source, /<AuthGate>/, `${canonical} must require a signed-in account`);
  assert.match(source, /Object\.keys\(query\)\.length > 0/, `${canonical} must discard all query parameters`);
  assert.ok(source.includes(`redirect("${canonical}")`), `${canonical} must redirect to its query-free canonical URL`);
  assert.doesNotMatch(source, /searchParams\.|JSON\.stringify\(query\)|Object\.values\(query\)/, `${canonical} must not render query values`);
}

assert.match(card, /\u753b\u9762\u304c\u8868\u793a\u3055\u308c\u305f\u3060\u3051\u3067\u306f\u3001\u5951\u7d04\u3084\u5229\u7528\u6a29\u306f\u78ba\u5b9a\u3057\u307e\u305b\u3093/);
assert.match(card, /\u6c7a\u6e08\u306f\u5b8c\u4e86\u3057\u3066\u304a\u3089\u305a\u3001\u65b0\u3057\u3044\u5951\u7d04\u3084\u5229\u7528\u6a29\u3082\u958b\u59cb\u3055\u308c\u3066\u3044\u307e\u305b\u3093/);
assert.match(card, /\u30b5\u30fc\u30d0\u30fc\u304b\u3089\u6700\u65b0\u72b6\u614b\u3092\u53d6\u5f97\u3057\u307e\u3059/);
assert.ok(card.includes('href="/academy/select"'));
assert.ok(card.includes('href="/community/for-organizers"'));
assert.doesNotMatch(card, /session_id|provider_event|requestId|resourceId|searchParams/);

console.log("platform_billing_return_pages_check_ok");
