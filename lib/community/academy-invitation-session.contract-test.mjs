import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const page = await readFile(fileURLToPath(new URL("../../app/community/academy-invitations/[invitationId]/page.tsx", import.meta.url)), "utf8");

assert.match(page, /const sessionKey = `\$\{user\.id\}:\$\{invitationId\}`/);
assert.match(page, /<InvitationContent key=\{sessionKey\}/);
assert.match(page, /requestState = useRef/);
assert.match(page, /isCurrentInvitationRequest\(key, generation, requestState\.current\)/);
assert.match(page, /\[invitationId, preview, userId\]/);
assert.match(page, /return \(\) => \{ active = false; \}/);

const require = createRequire(import.meta.url);
const typescript = require("typescript");
const sessionSource = await readFile(fileURLToPath(new URL("./academy-invitation-session.ts", import.meta.url)), "utf8");
assert.doesNotMatch(page, /export function (?:createInvitationSessionState|isCurrentInvitationRequest)/, "Next page must not export helper functions");
assert.match(page, /from "@\/lib\/community\/academy-invitation-session"/);
const transpiledPage = typescript.transpileModule(sessionSource, {
  compilerOptions: {
    jsx: typescript.JsxEmit.ReactJSX,
    module: typescript.ModuleKind.CommonJS,
    target: typescript.ScriptTarget.ES2022
  }
}).outputText;
const pageModule = { exports: {} };
const pageFactory = vm.runInNewContext(`(function(require,module,exports){${transpiledPage}\n})`, {
  process: { env: { NODE_ENV: "test" } },
  console
});
pageFactory((id) => {
  if (id === "react") {
    return { use() {}, useEffect() {}, useMemo() {}, useRef() {}, useState() {} };
  }
  if (id === "react/jsx-runtime") return { jsx() {}, jsxs() {} };
  if (id === "next/link") return { default() {} };
  if (id === "lucide-react") return new Proxy({}, { get: () => function Icon() {} });
  if (id === "@/components/AuthGate") return { AuthGate() {}, useAuth() {} };
  if (id === "@/lib/community/client") {
    return { acceptCommunityAcademyAccessInvitation() {}, getMyCommunityAcademyAccessInvitation() {} };
  }
  if (id === "@/lib/supabase/client") return { supabase: {} };
  throw new Error(`Unexpected module: ${id}`);
}, pageModule, pageModule.exports);

const { createInvitationSessionState, isCurrentInvitationRequest } = pageModule.exports;
const accountA = createInvitationSessionState("Aさん");
accountA.accepted = true;
accountA.consent.terms = true;
accountA.consent.rules = true;
accountA.consent.privacy = true;

const accountB = createInvitationSessionState("Bさん");
assert.equal(accountB.accepted, false, "accepted state is reset when a keyed session remounts");
assert.deepEqual(
  { ...accountB.consent },
  { terms: false, rules: false, privacy: false },
  "A account consent is not inherited by B account"
);
assert.equal(accountB.form.displayName, "Bさん");

assert.equal(
  isCurrentInvitationRequest("user-a:invite-1", 1, { key: "user-b:invite-1", generation: 1 }),
  false,
  "an A account response is stale after switching to B"
);
assert.equal(
  isCurrentInvitationRequest("user-b:invite-1", 1, { key: "user-b:invite-1", generation: 2 }),
  false,
  "an older request generation is stale for the same account"
);
assert.equal(
  isCurrentInvitationRequest("user-b:invite-1", 2, { key: "user-b:invite-1", generation: 2 }),
  true
);

console.log("community_academy_invitation_account_switch_contract_ok");
