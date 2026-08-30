import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wizard = readFileSync(new URL("../components/academy/AcademyCourseSetupWizard.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/academy/courses/new/page.tsx", import.meta.url), "utf8");
const form = readFileSync(new URL("../app/academy/courses/CourseForm.tsx", import.meta.url), "utf8");

assert.match(wizard, /講座づくり \{step\}\/6/, "wizard must show progress one question at a time");
assert.match(wizard, /下書きのため、まだ公開にはなりません/, "questionnaire must not imply automatic publication");
assert.match(wizard, /管理用コード（任意）/, "course code must be optional and explained");
assert.match(wizard, /answers\.code\.trim\(\) \|\| automaticCourseCode\(\)/, "empty course code must be generated safely");
assert.match(wizard, /講座の開催方法を選んでください/, "second question must ask course format");
assert.match(wizard, /講座申込はどなたが受付/, "third question must ask intake ownership");
assert.match(wizard, /教材（キット）を発送しますか/, "fourth question must ask shipping in beginner language");
assert.match(wizard, /オンラインのステップ教材（準備中）/, "pilot must not present disconnected step learning as usable");
assert.match(wizard, /外部URL.*復習ページ/s, "pilot must show the available learner-material alternative");
assert.match(form, /disabled=\{feature\.key === "stepLearning"\}/, "advanced settings must not re-enable step learning during pilot");
assert.match(wizard, /受講料（税込・円）/, "fifth question must request tax-inclusive price");
assert.match(wizard, /どのように講座を進めますか/, "sixth question must ask the operating pattern");
assert.match(wizard, /acceptAtHonbu: answers\.intake !== "koushi"/, "intake answer must configure headquarters intake");
assert.match(wizard, /kits: physicalMaterials/, "physical materials answer must configure kit operations");
assert.match(wizard, /certification: answers\.certification/, "certification answer must configure certification");
assert.match(wizard, /border-\[#3f4eb5\] bg-\[#3f4eb5\] text-white/, "selected choices must use the shared blue selected state");
assert.match(page, /initial=\{guidedInitial\}/, "answers must feed the existing detailed form");
assert.match(page, /非公開で講座を作成する/, "creation action must clearly remain unpublished");
assert.match(form, /質問から設定した機能/, "detailed form must explain the selected functions");
assert.match(form, /設定する場所：\{feature\.location\}/, "each function must show where it is configured");
assert.match(form, /詳細な機能設定を変更する/, "advanced checkboxes must be collapsed behind a clear label");
assert.match(form, /講座を紹介して、申込も受け付ける/, "course page and application setup must be one beginner-facing choice");
assert.match(form, /本部全体のホームページとは別/, "course page must be distinguished from the headquarters homepage");
assert.match(form, /mikke Communityまたは外部コミュニティ/, "certification conditions must support mikke or external communities");

console.log("Academy course setup wizard contract: OK");
