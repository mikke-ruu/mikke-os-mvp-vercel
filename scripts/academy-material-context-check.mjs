import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dashboard = fs.readFileSync(path.join(root, "app/academy/page.tsx"), "utf8");
const listPage = fs.readFileSync(path.join(root, "app/academy/materials/page.tsx"), "utf8");
const newPage = fs.readFileSync(path.join(root, "app/academy/materials/new/page.tsx"), "utf8");

for (const expected of ["courseNeedingMaterial", "features.materialLicenses", "material.course_id === course.id"]) {
  if (!dashboard.includes(expected)) throw new Error(`missing per-course material guide: ${expected}`);
}
if (!listPage.includes("encodeURIComponent(courseFilter)")) throw new Error("material list must preserve selected course");
if (!newPage.includes('searchParams.get("course") ?? ""')) throw new Error("material form must select query course");

console.log("Academy material context contract: OK");
