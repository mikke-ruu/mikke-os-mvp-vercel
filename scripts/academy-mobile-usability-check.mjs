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
if (instructors.includes("自分を講師として登録") || instructors.includes("受講者から登録")) {
  throw new Error("instructor registration choices must not be split into competing routes");
}
if ((classes.match(/開催日程を作成/g) ?? []).length !== 2 || classes.includes("最初の開催日程を作成")) {
  throw new Error("classes page must have one actionable create link and one explanatory reference");
}
if (!applications.includes("本部が直接受け付けた申込") || !applications.includes("各講師のページから届いた申込")) {
  throw new Error("application intake tabs must explain both intake sources");
}
for (const marker of ["本部責任者", "本部運営担当", "講座編集担当"]) {
  if (!settings.includes(marker)) throw new Error(`Japanese role label missing: ${marker}`);
}
if (settings.includes("Course Editorは本部情報を変更できません")) {
  throw new Error("null role must not be mislabeled as Course Editor");
}

console.log("academy_mobile_usability_contract_ok");
