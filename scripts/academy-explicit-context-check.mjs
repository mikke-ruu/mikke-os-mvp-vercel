import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = readFileSync(join(root, "next.config.ts"), "utf8");
const access = readFileSync(join(root, "lib/academy/access-context.ts"), "utf8");
const headquarters = readFileSync(join(root, "lib/academy/headquarters.ts"), "utf8");
const instructorPortal = readFileSync(join(root, "lib/academy/instructor-portal.ts"), "utf8");
const shell = readFileSync(join(root, "components/academy/AcademyShell.tsx"), "utf8");
const selector = readFileSync(join(root, "app/academy/select/page.tsx"), "utf8");

assert.match(config, /\/academy\/h\/:academyId\/manage/);
assert.match(config, /\/academy\/h\/:academyId\/teach/);
assert.match(access, /parseAcademyContextPath/);
assert.match(access, /toAcademyContextHref/);
assert.match(access, /toCurrentAcademyContextHref/);
assert.match(headquarters, /context\?\.portals\.includes\("manage"\)/);
assert.match(headquarters, /\.eq\("id", explicitAcademyId\)/);
assert.match(instructorPortal, /\.eq\("headquarters_id", explicitAcademyId\)/);
assert.match(shell, /toAcademyContextHref/);
assert.match(shell, /hasContextPathPrefix/);
assert.match(shell, /canShowManageHref/);
assert.match(shell, /manageHrefForCapabilityCheck/);
assert.match(shell, /profile\.user_id !== user\.id/);
assert.match(shell, /accessError/);
assert.match(access, /listLegacyReadonlyContexts/);
assert.match(access, /preview"\) === "readonly"/);
assert.match(shell, /onSubmitCapture=\{blockReadonlySubmit\}/);
assert.match(selector, /context\.academy_id/);

console.log("academy explicit URL context checks passed");
