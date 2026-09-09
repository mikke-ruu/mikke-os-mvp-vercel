import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
function load(file) {
  const module = { exports: {} };
  const source = readFileSync(file, "utf8");
  const { outputText } = ts.transpileModule(source, { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true
  } });
  vm.runInNewContext(outputText, { module, exports: module.exports, require(name) {
    if (name === "next/link") return ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children);
    if (name.startsWith("@/")) return load(path.resolve(`${name.slice(2)}.ts`));
    return require(name);
  } }, { filename: file });
  return module.exports;
}
const { CommunityDirectory } = load("components/community/CommunityDirectory.tsx");
const communities = [
  { id: "a", slug: "group-a", name: "同じ団体名", ownerUserId: "owner", description: "Aの説明" },
  { id: "b", slug: "group-b", name: "同じ団体名", ownerUserId: "owner", description: "Bの説明" },
  { id: "c", slug: "group-c", name: "運営を手伝う団体", ownerUserId: "someone-else" }
];
const render = (organizer, rows = communities) => renderToStaticMarkup(React.createElement(CommunityDirectory, { communities: rows, organizer, userId: "owner" }));
const managed = render(true);
for (const slug of ["group-a", "group-b", "group-c"]) assert.ok(managed.includes(`href="/community/c/${slug}/owner"`));
for (const id of ["a", "b"]) assert.ok(managed.includes(`href="/community/platform-billing?resourceId=${id}"`));
assert.ok(!managed.includes("platform-billing?resourceId=c"), "Moderator must not inherit owner billing navigation");
assert.ok(managed.includes("モデレーター"));
assert.equal((managed.match(/同じ団体名/g) || []).length, 2, "Equal names must not collapse separate tenants");
const participant = render(false);
assert.ok(!participant.includes("/owner"));
assert.ok(!participant.includes("platform-billing?resourceId="));
assert.ok(participant.includes('href="/community/start"'));
assert.ok(participant.includes('href="/community/manage"'));
assert.ok(render(true, []).includes("運営中のCommunityはありません"));
assert.ok(render(false, []).includes("参加中のCommunityはありません"));
assert.ok(!render(true, []).includes("group-a"));
console.log("Community directory: tenant-specific navigation, billing ownership, duplicate names and empty states passed");
