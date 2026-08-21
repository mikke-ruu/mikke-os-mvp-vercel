import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/marketnote-reflection-text.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
vm.runInNewContext(`(function (exports, module) { ${compiled}\n})(module.exports, module);`, { module });
const { mergeMarketNoteReflectionText } = module.exports;

const reflection = (input = {}) => ({
  id: "reflection-1",
  user_id: "user-1",
  profile_id: "profile-1",
  market_event_id: "event-1",
  public_summary: null,
  private_note: null,
  good_points: null,
  next_actions: null,
  created_at: "2026-08-22T00:00:00.000Z",
  updated_at: "2026-08-22T00:00:00.000Z",
  ...input
});

assert.equal(mergeMarketNoteReflectionText(null), "");
assert.equal(mergeMarketNoteReflectionText(reflection({ good_points: "良かったこと" })), "良かったこと");
assert.equal(mergeMarketNoteReflectionText(reflection({ next_actions: "次に試すこと" })), "次に試すこと");
assert.equal(
  mergeMarketNoteReflectionText(reflection({ good_points: "良かったこと", next_actions: "次に試すこと" })),
  "良かったこと\n\n次に試すこと"
);
assert.equal(
  mergeMarketNoteReflectionText(reflection({ good_points: "良かったこと\n\n次に試すこと", next_actions: "次に試すこと" })),
  "良かったこと\n\n次に試すこと"
);

console.log("MarketNote reflection text migration: OK");
