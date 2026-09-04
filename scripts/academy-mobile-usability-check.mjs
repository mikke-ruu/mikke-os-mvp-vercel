import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const form = read("app/academy/courses/CourseForm.tsx");
const courses = read("lib/academy/courses.ts");
const errors = read("lib/academy/course-save-errors.ts");
const shell = read("components/academy/AcademyShell.tsx");
const dashboard = read("app/academy/page.tsx");
const instructors = read("app/academy/instructors/page.tsx");
const classes = read("app/academy/classes/page.tsx");
const applications = read("app/academy/applications/page.tsx");
const settings = read("app/academy/settings/page.tsx");
const courseList = read("app/academy/courses/page.tsx");
const newCourse = read("app/academy/courses/new/page.tsx");
const courseCreationAccess = read("lib/academy/course-creation-access.ts");
const billingPanel = read("app/academy/billing/AcademyPlatformBillingPanel.tsx");

for (const marker of [
  "講座を保存できませんでした",
  "原因: {error}",
  "getAcademyCourseSaveErrorMessage"
]) {
  if (!form.includes(marker)) throw new Error(`course form marker missing: ${marker}`);
}

for (const marker of ["42501", "23505", "academy_trial_expired", "通信が途中で切れた"]) {
  if (!errors.includes(marker)) throw new Error(`safe save error marker missing: ${marker}`);
}

if (!courses.includes("Course creation succeeded")) {
  throw new Error("activity seam must not turn a completed course insert into a save failure");
}
if (!shell.includes("[&_input]:text-base") || !shell.includes("overflow-x-hidden")) {
  throw new Error("Academy shell must prevent mobile input zoom and horizontal overflow");
}
if (!dashboard.includes("aria-expanded={launchGuideOpen}") || !dashboard.includes("grid-cols-2")) {
  throw new Error("mobile launch guide must be collapsible and compact");
}
for (const href of ["/academy/courses", "/academy/instructors", "/academy/applications"]) {
  if (!dashboard.includes(`href=\"${href}\"`)) throw new Error(`dashboard stat target missing: ${href}`);
}
if (instructors.includes("自分を講師として登録") || instructors.includes("受講者から登録")) {
  throw new Error("instructor registration choices must not be split into competing routes");
}
if ((instructors.match(/講師を登録/g) ?? []).length !== 2) {
  throw new Error("instructor list must show one actionable registration route plus one empty-state reference");
}
if ((classes.match(/開催日程を作成/g) ?? []).length !== 2 || classes.includes("最初の開催日程を作成")) {
  throw new Error("classes page must have one actionable create link and one explanatory reference");
}
if (!applications.includes("本部が直接受け付けた申込") || !applications.includes("各講師のページから届いた申込")) {
  throw new Error("application intake tabs must explain both intake sources");
}
if (!applications.includes("koushiPendingCount") || !applications.includes("countUnattendedInstructorOrders")) {
  throw new Error("instructor intake tab must expose its unattended count before opening");
}
if (!courseList.includes("getMyAcademyCourseCreationAccess") || !courseList.includes('aria-disabled="true"')) {
  throw new Error("course list must disable creation before navigation when write access is unavailable");
}
if (!newCourse.includes("if (!createAccess?.allowed)")) {
  throw new Error("direct course creation route must stop before rendering the form");
}
if (!courseCreationAccess.includes('"academy:courses:manage"') || !courseCreationAccess.includes("can_manage_drafts")) {
  throw new Error("course creation must require both role capability and authoritative draft access");
}
for (const marker of ["開始日時:", "終了日時:", "料金と規約を確認し、同意して決済画面へ進んだ場合だけ"]) {
  if (!shell.includes(marker)) throw new Error(`trial timing marker missing: ${marker}`);
}
if (!dashboard.includes("開始ボタンを押した日時から7日間")) {
  throw new Error("trial start screen must explain when the seven-day period begins");
}
if (!billingPanel.includes("本人が確認・同意して") || !billingPanel.includes("課金手続きが始まります")) {
  throw new Error("billing screen must identify the explicit payment-start action");
}
for (const marker of ["本部責任者", "本部運営担当", "講座編集担当"]) {
  if (!settings.includes(marker)) throw new Error(`Japanese role label missing: ${marker}`);
}
if (settings.includes("Course Editorは本部情報を変更できません")) {
  throw new Error("null role must not be mislabeled as Course Editor");
}

console.log("academy_mobile_usability_contract_ok");
