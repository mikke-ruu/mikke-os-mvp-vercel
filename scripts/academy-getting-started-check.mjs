import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(new URL("../app/academy/page.tsx", import.meta.url), "utf8");

assert.match(dashboard, /listMaterials\(foundHq\.id\)/, "guide must derive progress from actual materials");
assert.match(dashboard, /はじめるガイド \{gettingStarted\.step\}\/4/, "guide must show one four-step position");
assert.match(dashboard, /最初に、募集する認定講座を作りますか？/, "first question must create a course");
assert.match(dashboard, /公開は確認後の明示操作です/, "guide must not auto-publish a course");
assert.match(dashboard, /受講者や講師へ渡す教材を登録しますか？/, "third question must cover materials");
assert.match(dashboard, /`\/academy\/c\/\$\{firstPublishedCourse!\.id\}`/, "final question must open public applicant view");
assert.match(dashboard, /process\.env\.NODE_ENV === "development"/, "preview data must be development-only");
assert.match(dashboard, /ローカル確認用Academy/, "preview must be visibly labelled as sample data");

console.log("Academy getting-started contract: OK");
