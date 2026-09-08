import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Exercise the actual private helper without mounting the shared shell.
const source = readFileSync(new URL("../components/mikkeos/MikkeAppShell.tsx", import.meta.url), "utf8");
const helper = source.match(/function findActiveHref\([^]*?\n\}/)?.[0];
assert.ok(helper, "findActiveHref must exist");
const js = ts.transpileModule(helper, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const findActiveHref = runInNewContext(`${js}\nfindActiveHref`);
const cases = [
  ["/apps/media", [], null],
  ["/other", ["/apps/media"], null],
  ["/apps/media", ["/apps/media"], "/apps/media"],
  ["/apps/media", ["/apps/media?preview=integration"], "/apps/media?preview=integration"],
  ["/apps/media/articles", ["/apps/media?preview=integration", "/apps/media/articles?preview=integration"], "/apps/media/articles?preview=integration"],
  ["/apps/media/articles/one", ["/apps/media", "/apps/media/articles"], "/apps/media/articles"],
  ["/apps/media/articles/one", ["/apps/media?very-long-query=012345678901234567890123456789", "/apps/media/articles?q=1"], "/apps/media/articles?q=1"],
  ["/apps/media/articles/one", ["/apps/media/articles?q=1", "/apps/media?very-long-query=012345678901234567890123456789"], "/apps/media/articles?q=1"],
  ["/story/collection", ["/story", "/story/collection#story-qr-reader"], "/story/collection#story-qr-reader"],
  ["/apps/media/articles", ["/apps/media/articles?q=1#section"], "/apps/media/articles?q=1#section"],
  ["/apps/media/articles", ["/apps/media/articles#section?q=1"], "/apps/media/articles#section?q=1"],
  ["/apps/media/articles-new", ["/apps/media/articles?q=1"], null],
  ["/apps/media/articles/one", ["/apps/media/articles/?q=1"], "/apps/media/articles/?q=1"],
  ["/", ["/?preview=integration"], "/?preview=integration"],
  ["/apps/media", ["", "#section", "?preview=integration"], null],
  ["/academy/courses", ["/academy/courses?tab=one", "/academy/courses?tab=longer"], "/academy/courses?tab=one"]
];
for (const [pathname, hrefs, expected] of cases) {
  assert.equal(findActiveHref(pathname, hrefs), expected, JSON.stringify({ pathname, hrefs }));
}
console.log(`MikkeAppShell active href: PASS (${cases.length} cases)`);
