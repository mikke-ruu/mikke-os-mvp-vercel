import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migration = readFileSync(join(root, "supabase/migrations/20260825075830_academy_application_claim.sql"), "utf8");
const applications = readFileSync(join(root, "lib/academy/applications.ts"), "utf8");
const graduate = readFileSync(join(root, "lib/academy/graduate.ts"), "utf8");
const claimPage = readFileSync(join(root, "app/academy/claim/[applicationId]/page.tsx"), "utf8");
const intake = readFileSync(join(root, "supabase/functions/academy-application-intake/index.ts"), "utf8");
const dashboard = readFileSync(join(root, "app/academy/page.tsx"), "utf8");

const required = [
  [migration, "email_confirmed_at is not null"],
  [migration, "academy_claim_my_application"],
  [migration, "application.user_id is null"],
  [migration, "grant execute on function public.academy_claim_my_application(uuid)\n  to authenticated"],
  [applications, "user_id: null"],
  [graduate, 'supabase.rpc("academy_claim_my_application"'],
  [claimPage, "マイポータルにつなぎました"],
  [intake, "/academy/claim/"],
  [dashboard, 'href: "/academy/front"']
];

for (const [source, needle] of required) {
  if (!source.includes(needle)) throw new Error(`missing Academy application claim contract: ${needle}`);
}

if (applications.includes("user_id: profile.user_id,")) {
  throw new Error("HQ-created applications must not be linked to the operator");
}

console.log("Academy application claim contract: OK");
