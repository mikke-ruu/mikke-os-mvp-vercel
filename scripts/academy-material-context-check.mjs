import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dashboard = fs.readFileSync(path.join(root, "app/academy/page.tsx"), "utf8");
const launchProgress = fs.readFileSync(path.join(root, "lib/academy/launch-progress.ts"), "utf8");
const listPage = fs.readFileSync(path.join(root, "app/academy/materials/page.tsx"), "utf8");
const newPage = fs.readFileSync(path.join(root, "app/academy/materials/new/page.tsx"), "utf8");

for (const expected of ["needsInstructorMaterials: resolveAcademyCourseFeaturesForCourse(course).materialLicenses", "materialCourseIds: materials.map(material => material.course_id)"]) {
  if (!dashboard.includes(expected)) throw new Error(`missing per-course material guide: ${expected}`);
}
for (const expected of ["missingMaterial", "course.needsInstructorMaterials", "materialCourseIds.includes(course.id)"]) {
  if (!launchProgress.includes(expected)) throw new Error(`missing launch-progress material guide: ${expected}`);
}
if (!listPage.includes("encodeURIComponent(courseFilter)")) throw new Error("material list must preserve selected course");
if (!newPage.includes('searchParams.get("course") ?? ""')) throw new Error("material form must select query course");

console.log("Academy material context contract: OK");
