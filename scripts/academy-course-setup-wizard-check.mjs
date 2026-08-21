import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wizard = readFileSync(new URL("../components/academy/AcademyCourseSetupWizard.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/academy/courses/new/page.tsx", import.meta.url), "utf8");

assert.match(wizard, /講座づくり \{step\}\/6/, "wizard must show progress one question at a time");
assert.match(wizard, /この段階では公開されません/, "questionnaire must not imply automatic publication");
assert.match(wizard, /acceptAtHonbu: answers\.intake !== "koushi"/, "intake answer must configure headquarters intake");
assert.match(wizard, /kits: physicalMaterials/, "physical materials answer must configure kit operations");
assert.match(wizard, /certification: answers\.certification/, "certification answer must configure certification");
assert.match(page, /initial=\{guidedInitial\}/, "answers must feed the existing detailed form");
assert.match(page, /非公開で講座を作成する/, "creation action must clearly remain unpublished");

console.log("Academy course setup wizard contract: OK");
