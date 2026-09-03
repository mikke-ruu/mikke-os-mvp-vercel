import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const catalog = JSON.parse(readFileSync("docs/platform-billing-production-catalog-2026-09-04.json", "utf8"));
const server = readFileSync("lib/billing/platform/server.ts", "utf8");
const page = readFileSync("components/legal/LegalMarkdownPage.tsx", "utf8");

const hashes = {
  "academy-billing-2026-09-04-v1.md": "42e9007e0a2972829e669cf129bb3a3019166320ced4350b624a8579b9bd4ce6",
  "academy-terms-2026-09-04-v1.md": "7d5c023062f869ba35afd3a4dd4ff1dd3ceaa1389082af45c62b17ab684c5670",
  "commercial-disclosure-2026-09-04-v1.md": "e2191ae38b9162faeeecc147e8aceb6236021ccd293d1851e093ce86717b363e",
  "community-billing-2026-09-04-v1.md": "bbcc991eee1e81ace9ce841e276ece7bac236741fcd2f0cb3088ee610e0446a4",
  "community-terms-2026-09-04-v1.md": "b2dfabab728b34b351f56155b4ef8dcd497de3faf4f61a369ccf24df0e9a1b24",
  "privacy-2026-09-04-v1.md": "2faba8181bde95ba72ddda8af7c8683b0360be009bcca1c915c0689dd9aefc00"
};

for (const [name, expected] of Object.entries(hashes)) {
  const actual = createHash("sha256").update(readFileSync(`legal-content/${name}`)).digest("hex");
  assert.equal(actual, expected, `${name} must match the approved legal text`);
}

assert.equal(catalog.approvalId, "ojas-platform-legal-2026-09-04-v1");
assert.equal(catalog.revision, 1);
assert.deepEqual(Object.keys(catalog.policies).sort(), ["academy_platform", "community_platform"]);
assert.notEqual(catalog.policies.academy_platform.terms.url, catalog.policies.community_platform.terms.url);
assert.notEqual(catalog.policies.academy_platform.refund.url, catalog.policies.community_platform.refund.url);

const names = ["terms", "privacy", "refund", "cancellation", "proration", "renewal", "commercialDisclosure"];
for (const product of ["academy_platform", "community_platform"]) {
  const policies = catalog.policies[product];
  assert.deepEqual(Object.keys(policies).sort(), ["approvalId", "approved", "revision", ...names].sort());
  assert.equal(policies.approved, true);
  assert.equal(policies.approvalId, catalog.approvalId);
  assert.equal(policies.revision, catalog.revision);
  for (const name of names) {
    assert.match(policies[name].version, /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/);
    assert.equal(new URL(policies[name].url).origin, "https://app.mikke-os.com");
  }
}

assert.deepEqual(Object.fromEntries(Object.entries(catalog.plans).map(([key, value]) => [key, value.totalYen])), {
  "academy_platform:small": 5000,
  "academy_platform:medium": 10000,
  "academy_platform:large": 20000,
  "community_platform:starter": 2980,
  "community_platform:standard": 4980,
  "community_platform:pro": 9800
});
assert.match(server, /function policiesFor\(/);
assert.match(server, /policies:policiesFor\(current,input\.product\)/);
assert.match(page, /id=\{sectionId\(heading\)\}/);
for (const anchor of ["refund", "cancellation", "proration", "renewal"]) assert.match(page, new RegExp(`return "${anchor}"`));

console.log("platform_billing_production_legal_check_ok");
