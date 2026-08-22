import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const preview = read("lib/academy/preview.ts");
const shell = read("components/academy/AcademyShell.tsx");
const authGate = read("components/AuthGate.tsx");

assert.ok(preview.includes('process.env.NODE_ENV !== "development"'), "Preview fixtures must be development-only");
assert.ok(preview.includes('preview === "walkthrough"'), "Walkthrough query must explicitly enable fixtures");
assert.ok(preview.includes("export function assertAcademyWritable"), "Walkthrough must expose a write guard");
assert.ok(shell.includes('previewMode === "walkthrough"'), "AcademyShell must recognize walkthrough mode");
assert.ok(shell.includes('preview=${preview}'), "Academy links must preserve the walkthrough query");
assert.ok(shell.includes('portalOverride?: "manage" | "teach"'), "Portal switching must override the current portal");
assert.ok(authGate.includes('pathname.startsWith("/academy")'), "Local auth bypass must be scoped to Academy");
assert.ok(authGate.includes('["dashboard", "walkthrough"]'), "Local auth bypass must require an explicit preview query");

const readModules = [
  "lib/academy/access-context.ts",
  "lib/academy/applications.ts",
  "lib/academy/classes.ts",
  "lib/academy/class-instructor-requests.ts",
  "lib/academy/courses.ts",
  "lib/academy/graduate.ts",
  "lib/academy/headquarters.ts",
  "lib/academy/headquarters-settings.ts",
  "lib/academy/instructor-addresses.ts",
  "lib/academy/instructor-page.ts",
  "lib/academy/instructor-portal.ts",
  "lib/academy/instructors.ts",
  "lib/academy/kits.ts",
  "lib/academy/lp.ts",
  "lib/academy/materials.ts",
  "lib/academy/programs.ts"
];

for (const path of readModules) {
  assert.ok(read(path).includes("isAcademyLocalReview"), `${path} must use walkthrough fixtures for reads`);
}

const mutationModules = [
  "lib/academy/applications.ts",
  "lib/academy/classes.ts",
  "lib/academy/class-instructor-requests.ts",
  "lib/academy/courses.ts",
  "lib/academy/events.ts",
  "lib/academy/graduate.ts",
  "lib/academy/headquarters.ts",
  "lib/academy/headquarters-settings.ts",
  "lib/academy/instructor-addresses.ts",
  "lib/academy/instructor-page.ts",
  "lib/academy/instructor-portal.ts",
  "lib/academy/instructors.ts",
  "lib/academy/kits.ts",
  "lib/academy/lp.ts",
  "lib/academy/materials.ts",
  "lib/academy/programs.ts"
];

for (const path of mutationModules) {
  assert.ok(read(path).includes("assertAcademyWritable"), `${path} must block walkthrough mutations`);
}

console.log("Academy local walkthrough contracts: OK");
