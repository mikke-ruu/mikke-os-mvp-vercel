import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(new URL("../app/academy/page.tsx", import.meta.url), "utf8");
const preview = readFileSync(new URL("../lib/academy/preview.ts", import.meta.url), "utf8");
const progress = readFileSync(new URL("../lib/academy/launch-progress.ts", import.meta.url), "utf8");

assert.match(dashboard, /listMaterials\(foundHq\.id\)/, "guide must derive progress from actual materials");
assert.match(dashboard, /Academy開講までの流れ/, "dashboard must show the overall launch journey");
assert.match(dashboard, /次にすること ・ STEP \{gettingStarted\.step\}/, "guide must use the same step as the journey model");
assert.match(progress, /本部を設定/, "journey must start with headquarters settings");
assert.match(progress, /本部ホームページを作成/, "journey must distinguish the headquarters homepage");
assert.match(progress, /講師を登録/, "journey must include instructor registration");
assert.match(dashboard, /本部ホームページ<\/span>は団体全体の紹介/, "homepage and course application page must be explained separately");
assert.match(progress, /講座の下書きができます/, "guide must describe draft creation");
assert.doesNotMatch(progress, /fetch\(|supabase|is_published\s*=/, "progress model cannot publish a course");
assert.match(progress, /講師用ファイルを使う設定/, "instructor file step must explain its audience");
assert.doesNotMatch(dashboard, /受講者と認定講師のどちらに見せるか/, "learner review content and instructor files must not be mixed");
assert.match(progress, /`\/academy\/c\/\$\{published\.id\}`/, "applicant view is available for published courses");
assert.match(progress, /steps\.find\(step => step\.state !== "complete"\)/, "next step comes from the journey, not a second decision tree");
assert.match(dashboard, /process\.env\.NODE_ENV === "development"/, "preview data must be development-only");
assert.match(dashboard, /academyPreviewHeadquarters/, "dashboard must use the shared walkthrough fixture");
assert.match(preview, /ローカル確認用Academy/, "preview must be visibly labelled as sample data");
assert.match(preview, /WORKSHOP-03/, "preview must include a workshop-level course pattern");
assert.match(preview, /PRO-04/, "preview must include a certified-instructor sales pattern");

console.log("Academy getting-started contract: OK");
