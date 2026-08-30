import fs from "node:fs";
import path from "node:path";

const page = fs.readFileSync(path.join(process.cwd(), "app/academy/apply/[id]/page.tsx"), "utf8");

for (const expected of [
  "resolveAcademyCourseFeaturesForCourse",
  "日程のご連絡に使うメールアドレスを入力してください。",
  "お申込み後に担当者からメールでご案内",
  "features.certification ?",
  "features.kits && (selectedClass?.format ?? format) === \"online\"",
  "classId: selectedClass?.id ?? null",
  "希望する開催日程を選んでください。"
]) {
  if (!page.includes(expected)) throw new Error(`missing public application contract: ${expected}`);
}

if (page.includes('label className={labelClass}>受講希望日')) {
  throw new Error("application form must not present a preferred-date calendar");
}

console.log("Academy public application contract: OK");
