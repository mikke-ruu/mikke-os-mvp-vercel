import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/academy/launch-progress.ts", import.meta.url), "utf8");
const module = { exports: {} };
new Function("module", "exports", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(module, module.exports);
const { getAcademyLaunchProgress: progress } = module.exports;
const headquarters = { name: "サンプル本部", contact_email: "fixture@example.invalid", front_message: null, front_blocks: [] };
const course = { id: "course-a", name: "講座A", is_published: true, needsInstructorMaterials: false };
const input = { headquarters, courses: [], materialCourseIds: [], instructorCount: 0 };
function check(overrides) {
  const result = progress({ ...input, ...overrides });
  const first = result.steps.find(step => step.state !== "complete");
  assert.equal(result.next.step, first.step);
  assert.equal(result.next.href, first.href);
  assert.equal(result.steps.filter(step => step.isCurrent).length, 1);
  assert.equal(result.steps.find(step => step.isCurrent).step, result.next.step);
  assert.equal(result.steps[5].state, "unconfirmed", "publication is not proof of visual review");
  return result;
}
assert.equal(check({}).next.step, 2, "no courses");
assert.equal(check({ headquarters: { ...headquarters, contact_email: null } }).next.step, 1);
assert.equal(check({ headquarters: { ...headquarters, name: " " } }).steps[0].state, "incomplete");
const published = check({ courses: [course], instructorCount: 2 });
assert.equal(published.next.step, 3, "reported 1/2/5 complete must not jump to 6");
assert.equal(published.steps[2].state, "unconfirmed");
assert.equal(published.steps[3].state, "incomplete");
assert.equal(published.steps[5].label, "申込ページを確認");
assert.equal(published.steps[5].href, "/academy/c/course-a");
assert.equal(check({ courses: [course] }).steps[4].state, "incomplete", "zero instructors");
const materialCourse = { ...course, needsInstructorMaterials: true };
const missing = check({ courses: [materialCourse] });
assert.equal(missing.next.state, "incomplete");
assert.equal(missing.next.href, "/academy/materials/new?course=course-a");
assert.equal(check({ courses: [materialCourse], materialCourseIds: ["other-course"] }).next.state, "incomplete");
assert.equal(check({ courses: [materialCourse], materialCourseIds: [course.id] }).next.state, "unconfirmed");
const draft = { ...course, id: "course-b", name: "講座B", is_published: false };
assert.equal(check({ courses: [course, draft] }).next.href, "/academy/courses/course-b");
assert.equal(check({ courses: [draft, materialCourse] }).next.href, missing.next.href);
assert.equal(check({ courses: [draft] }).steps[5].label, "公開前に確認");
assert.equal(check({ headquarters: { ...headquarters, front_blocks: [{ type: "text", text: " " }] } }).steps[3].state, "incomplete");
assert.equal(check({ headquarters: { ...headquarters, front_message: "団体の紹介" } }).steps[3].state, "complete");
assert.equal(check({ headquarters: { ...headquarters, front_blocks: [{ type: "text", text: "紹介文" }] } }).steps[3].state, "complete");
for (const courses of [[], [course], [draft], [materialCourse], [course, draft], [materialCourse, draft]]) {
  for (const instructorCount of [0, 1]) {
    for (const contact_email of [null, "fixture@example.invalid"]) {
      for (const front_message of [null, "保存済み"]) {
        check({ courses, instructorCount, headquarters: { ...headquarters, contact_email, front_message } });
      }
    }
  }
}
const page = readFileSync(new URL("../app/academy/page.tsx", import.meta.url), "utf8");
assert.match(page, /steps: launchSteps, next: gettingStarted/);
assert.match(page, /gettingStarted\.step/);
assert.match(page, /aria-current=\{item.isCurrent/);
assert.doesNotMatch(page, /const launchSteps = \[|gettingStarted\.position|gettingStarted\.question|公開前の最終確認をしましょう/);
assert.doesNotMatch(source, /localStorage|sessionStorage|supabase|fetch\(/);
console.log("Academy launch progress: 48 combinations + no-course/published/material/instructor/mixed-course regressions OK");
