import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20260821103043_academy_class_management.sql");
const library = read("lib/academy/classes.ts");
const listPage = read("app/academy/classes/page.tsx");
const newPage = read("app/academy/classes/new/page.tsx");
const shell = read("components/academy/AcademyShell.tsx");
const programLibrary = read("lib/academy/programs.ts");
const programPage = read("app/academy/courses/[id]/program/page.tsx");

for (const expected of [
  "private.academy_can_manage_headquarters(headquarters_id)",
  "private.academy_class_scope_valid(",
  "created_by_user_id = (select auth.uid())"
]) {
  if (!migration.includes(expected)) throw new Error(`missing class RLS contract: ${expected}`);
}

for (const expected of ["createAcademyClass", "getCourseProgram", "現在の内容を確定してください", "created_by_user_id: profile.user_id"]) {
  if (!library.includes(expected)) throw new Error(`missing class creation contract: ${expected}`);
}

if (!programLibrary.includes('rpc("academy_publish_program_version"')) {
  throw new Error("program publishing RPC must be connected before class creation");
}
if (!programPage.includes("現在の内容を確定する")) {
  throw new Error("program page must expose version publishing before class creation");
}

if (!listPage.includes("/academy/classes/new")) throw new Error("class list must expose the creation route");
if (!shell.includes('href.startsWith("/academy/classes")') || !shell.includes('academy:headquarters:manage')) {
  throw new Error("class management must be hidden from course editors");
}
for (const expected of ["日程の決め方", "申込後に個別調整", "非公開でクラスを作成する"]) {
  if (!newPage.includes(expected)) throw new Error(`missing class creation UI: ${expected}`);
}

console.log("Academy class management contract: OK");
