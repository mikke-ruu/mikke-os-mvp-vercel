import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  academyContextQuery,
  withAcademyContextQuery
} from "../lib/academy/context-query.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shell = readFileSync(join(root, "components/academy/AcademyShell.tsx"), "utf8");
const workspace = readFileSync(join(root, "components/academy/AcademyCourseWorkspace.tsx"), "utf8");
const builder = readFileSync(join(root, "app/academy/courses/[id]/instructor-page/page.tsx"), "utf8");
const authGate = readFileSync(join(root, "components/AuthGate.tsx"), "utf8");

assert.equal(academyContextQuery("audience=learner"), "audience=learner");
assert.equal(academyContextQuery("audience=instructor"), "audience=instructor");
assert.equal(academyContextQuery(""), "");
assert.equal(academyContextQuery("audience=unknown"), "");
assert.equal(academyContextQuery("audience=learner&audience=instructor"), "");
assert.equal(academyContextQuery("audience=learner&token=secret&course=private-id"), "audience=learner");

const contextualHref = "/academy/h/00000000-0000-4000-8000-000000000001/manage/courses/course-id/instructor-page";
assert.equal(
  withAcademyContextQuery(contextualHref, "audience=learner"),
  `${contextualHref}?audience=learner`
);
assert.equal(withAcademyContextQuery(contextualHref, ""), contextualHref);
assert.equal(
  withAcademyContextQuery(contextualHref, "audience=learner&preview=trial", { readonlyPreview: true }),
  `${contextualHref}?audience=learner&preview=readonly`
);

assert.match(shell, /withAcademyContextQuery\(canonicalHref, canonicalSearch/);
assert.match(workspace, /instructor-page\?audience=learner/);
assert.match(workspace, /instructor-page`/);
assert.match(builder, /searchParams\.get\("audience"\) === "learner" \? "learner" : "instructor"/);
assert.match(authGate, /const nextPath = search \? `\$\{pathname\}\?\$\{search\}` : pathname/);
assert.match(authGate, /router\.replace\(`\/login\?next=\$\{encodeURIComponent\(nextPath\)\}`\)/);

console.log("Academy context query contract: OK");
