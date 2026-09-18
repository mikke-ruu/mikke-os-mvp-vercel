const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const read = (path) => fs.readFileSync(path, "utf8");
function loadTs(path, imports = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (name) => imports[name] ?? {}, process: { env: { NODE_ENV: "production" } } });
  return module.exports;
}
async function main() {
  const context = loadTs("lib/academy/access-context.ts");
  const hq = "00000000-0000-4000-8000-000000000001";
  assert.equal(context.toAcademyContextHref("/academy/offering-applications/mine", hq, "manage"), `/academy/h/${hq}/teach/offering-applications/mine`);
  assert.equal(context.toAcademyContextHref("/academy/offering-applications/mine?view=learner", hq), `/academy/h/${hq}/teach/offering-applications/mine?view=learner`);
  assert.equal(context.toAcademyContextHref("/academy/offerings", hq, "manage"), `/academy/h/${hq}/manage/offerings`);
  assert.equal(context.toAcademyContextHref("/academy/offering-applications", hq, "manage"), `/academy/h/${hq}/manage/offering-applications`);
  assert.equal(context.toAcademyContextHref("/academy/portal/offering-applications", hq), `/academy/h/${hq}/teach/offering-applications`);
  const config = loadTs("next.config.ts").default;
  const routes = await config.rewrites();
  const mineIndex = routes.findIndex(row => row.source === "/academy/h/:academyId/teach/offering-applications/mine");
  assert(mineIndex >= 0);
  assert.equal(routes[mineIndex].destination, "/academy/offering-applications/mine");
  assert(mineIndex < routes.findIndex(row => row.source === "/academy/h/:academyId/teach/:path*"));
  assert(routes.some(row => row.source === "/academy/h/:academyId/manage/:path*" && row.destination === "/academy/:path*"));
  const ui = read("components/academy/OfferingApplications.tsx");
  for (const expected of ['query.eq("headquarters_id", hq.id)', 'query.eq("learner_user_id", userId)', 'getOwnedHeadquarters(userId, academyId)', 'supabase.rpc("academy_confirm_offering_payment", { p_application_id: row.id })', 'row.status !== "pending"', '["bank", "onsite"].includes(row.payment_method)', 'pending.current = true', 'course_snapshot', 'audience === "learner" && row.status === "paid"', 'row.headquarters_id, "teach"']) assert(ui.includes(expected), expected);
  assert(!/\.update\(|\.insert\(|\.upsert\(|localStorage|academyPreview/.test(ui));
  for (const expected of ['linkQuery.eq("owner_user_id", userId)', 'query = query.in("id", assignedIds)', 'if (assignedIds.length === 0) return', 'if (linkError) throw linkError', 'audience === "instructor" || row.status', 'instructorPages[row.id] ? `/academy/oi/${instructorPages[row.id]}#apply`']) assert(ui.includes(expected), expected);
  assert(read("app/academy/portal/offering-applications/page.tsx").includes('audience="instructor"'));
  const study = read("app/academy/portal/study/page.tsx");
  for (const expected of ['.eq("learner_user_id", profile.user_id).eq("status", "paid")', 'resolveCourseAccessGrant(accessGrants, courseId)', 'access.state === "active"', '...offeringCourseIds', 'if (loadError) return']) assert(study.includes(expected), expected);
  console.log("PASS: offering application routes, scoped reads, guarded manual RPC, snapshot display, and study access gate");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
