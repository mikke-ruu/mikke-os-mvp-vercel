import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "components/academy/AcademyShell.tsx"),
  "utf8"
);

const required = [
  'headquartersAccess?.access_kind === "trial"',
  "7日間お試し ・ あと${headquartersAccess.days_remaining}日",
  "開始日時:",
  "終了日時:",
  "自動課金はされません",
  'headquartersAccess?.access_kind === "paid" && !accessNotice',
  "Academyを利用できます",
  "Academy有料プランを利用中です",
  "Academy利用料金を確認する",
];

for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`missing Academy access banner marker: ${marker}`);
}

if (/access_kind\s*===\s*["']trial["']\s*\?\s*["']paid["']/u.test(source)) {
  throw new Error("trial access must not be presented as paid access");
}

console.log("academy_access_banner_contract_ok");
