import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const portal = readFileSync(new URL("../app/academy/portal/applications/page.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../app/academy/applications/[id]/page.tsx", import.meta.url), "utf8");
const front = readFileSync(new URL("../app/academy/front/page.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260821100151_academy_application_headquarters_visibility.sql", import.meta.url), "utf8");

assert.match(portal, /mailto:\$\{a\.applicant_email\}/, "instructor must have a direct applicant email action");
assert.match(portal, /tel:\$\{a\.applicant_phone\}/, "instructor must be able to call a supplied phone number");
assert.match(portal, /先に.*受講日を決めてから登録/u, "schedule guidance must precede kit ordering");
assert.match(portal, /教材仕入れ金額/, "kit amount must be visible before confirmation");
assert.match(portal, /finally\s*\{\s*setLoading\(false\)/, "portal loading must finish on errors");
assert.match(detail, /申込詳細を開けませんでした/, "detail must show a recoverable load error");
assert.match(front, /academy\/site\/\$\{encodeURIComponent\(hq\.handle\)\}/, "preview must target the selected headquarters handle");
assert.match(migration, /private\.academy_can_manage_headquarters\(headquarters_id\)/, "manager access must be headquarters-scoped");
assert.doesNotMatch(migration, /academy_owns_hq\(headquarters_id\).*intake_source\s*=\s*'honbu'/s, "manager access must not exclude instructor intake");
assert.match(migration, /academy_is_instructor_self\(instructor_id\)/, "instructor access must remain scoped to the assigned instructor");

console.log("Academy application operations contract: OK");
