import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { randomUUID } from "node:crypto";

const source = fs.readFileSync(new URL("../components/media-app/MediaCloudBlockFields.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const exports = {};
const jsx = (type, props) => ({ type, props });
vm.runInNewContext(compiled, { exports, URL, require(name) {
  if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
  if (name === "react") return { useRef: () => ({ current: null }), useEffect() {} };
  if (name === "./MediaImagePicker") return { MediaImagePicker: "private-image-picker" };
  throw Error(`Unexpected import: ${name}`);
} });

function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (typeof tree.type === "function") return nodes(tree.type(tree.props));
  const children = [tree.props?.children].flat(Infinity);
  return [tree, ...children.flatMap(nodes)];
}
const fields = exports.MediaCloudBlockFields;
function render(block) {
  let changed;
  const splits = [];
  const tree = fields({ block, onChange: value => { changed = value; }, onSplit: (...value) => splits.push(value) });
  return { all: nodes(tree), get changed() { return changed; }, splits };
}
const plain = value => JSON.parse(JSON.stringify(value));
const allowed = {
  paragraph: ["id", "type", "text"], heading: ["id", "type", "text", "level"],
  image: ["id", "type", "imageUrl", "imageAssetId", "alt", "caption"],
  quote: ["id", "type", "text", "attribution"], list: ["id", "type", "items"],
  divider: ["id", "type"], link: ["id", "type", "url", "title"]
};
function checkKeys(block) { for (const key of Object.keys(block)) assert.ok(allowed[block.type].includes(key), `${block.type}: unsupported ${key}`); }

for (const block of [{ id: "p", type: "paragraph", text: "本文" }, { id: "h", type: "heading", text: "見出し", level: 2 }]) {
  const view = render(block); const field = view.all.find(node => node.type === "textarea");
  field.props.onChange({ target: { value: "編集した本文" } });
  assert.equal(view.changed.text, "編集した本文"); checkKeys(view.changed);
  let prevented = false;
  const event = { key: "Enter", shiftKey: false, nativeEvent: { isComposing: false }, keyCode: 13, currentTarget: { selectionStart: 2, selectionEnd: 3 }, preventDefault() { prevented = true; } };
  field.props.onKeyDown(event); assert.ok(prevented); assert.deepEqual(plain(view.splits), [[2, 3]]);
  field.props.onKeyDown({ ...event, nativeEvent: { isComposing: true } });
  field.props.onKeyDown({ ...event, shiftKey: true }); assert.equal(view.splits.length, 1);
}
const pasted = render({ id: "p", type: "paragraph", text: "" });
let pastePrevented = false;
pasted.all.find(node => node.type === "textarea").props.onPaste({ clipboardData: { getData: () => "https://youtu.be/abcdefghijk" }, preventDefault() { pastePrevented = true; } });
assert.ok(pastePrevented); assert.equal(pasted.changed.type, "link"); checkKeys(pasted.changed);

const link = render({ id: "l", type: "link", url: "https://example.com", title: "表示名" });
link.all.find(node => node.type === "input" && node.props.type === "url").props.onChange({ target: { value: "https://example.org" } });
checkKeys(link.changed); assert.equal(link.changed.title, "表示名"); assert.equal(link.changed.url, "https://example.org");

const image = render({ id: "i", type: "image", imageUrl: "", alt: "", caption: "説明" });
image.all.find(node => node.type === "private-image-picker").props.onSelect({ id: "private-asset-id", publicUrl: "/api/media/assets/private-asset-id", originalName: "花.jpg" });
assert.equal(image.changed.imageAssetId, "private-asset-id"); assert.equal(image.changed.caption, "説明"); checkKeys(image.changed);
const quote = render({ id: "q", type: "quote", text: "引用", attribution: "出典" });
quote.all.find(node => node.type === "textarea").props.onChange({ target: { value: "引用の編集" } });
assert.equal(quote.changed.attribution, "出典"); checkKeys(quote.changed);
const list = render({ id: "l", type: "list", items: ["最初", "次"] });
list.all.find(node => node.type === "textarea").props.onChange({ target: { value: "変更" } });
assert.deepEqual(plain(list.changed.items), ["変更", "次"]); checkKeys(list.changed);
assert.equal(render({ id: "d", type: "divider" }).all[0].type, "hr");

// Exercise the actual parent editor and block factory, not a copy of their logic.
const storeExports = {};
const transpile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
vm.runInNewContext(transpile(fs.readFileSync(new URL("../lib/media-app/store.ts", import.meta.url), "utf8")), {
  exports: storeExports, require() { return {}; }
});
const inlineExports = {};
vm.runInNewContext(transpile(fs.readFileSync(new URL("../components/media-app/MediaInlineEditor.tsx", import.meta.url), "utf8")), {
  exports: inlineExports, crypto: { randomUUID }, require(name) {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "react") return { Fragment: "fragment", useRef: () => ({ current: null }), useEffect() {} };
    if (name === "lucide-react") return { ArrowUp: "icon", ArrowDown: "icon", Copy: "icon", Trash2: "icon" };
    if (name === "@/lib/media-app/store") return storeExports;
    if (name === "@/components/mikkeos/content/MikkeInsertMenu") return { MikkeInsertMenu: "insert-menu" };
    throw Error(`Unexpected parent import: ${name}`);
  }
});
function parent(initial) {
  let blocks = initial;
  let callbacks = [];
  return {
    get blocks() { return blocks; },
    get callbacks() { return callbacks; },
    render() {
      callbacks = [];
      return nodes(inlineExports.MediaInlineEditor({ blocks, onChange(next) { blocks = next; }, renderBlock(block, onChange, onSplit) {
        callbacks.push({ block, onChange, onSplit }); return null;
      } }));
    }
  };
}
const parentEditor = parent([{ id: "heading", type: "heading", text: "ABCDEF", level: 3 }, { id: "existing", type: "paragraph", text: "保持する本文" }]);
parentEditor.render(); parentEditor.callbacks[0].onSplit(2, 4);
assert.equal(parentEditor.blocks[0].text, "AB"); assert.equal(parentEditor.blocks[0].level, 3);
assert.equal(parentEditor.blocks[1].text, "EF"); assert.equal(parentEditor.blocks[1].type, "paragraph");
assert.equal(parentEditor.blocks[2].text, "保持する本文"); parentEditor.blocks.forEach(checkKeys);
for (const type of Object.keys(allowed)) {
  const menu = parentEditor.render().find(node => node.type === "insert-menu");
  assert.deepEqual([...menu.props.allowedTypes].sort(), Object.keys(allowed).sort());
  menu.props.onInsert(type, type === "heading" ? 3 : undefined);
  assert.equal(parentEditor.blocks[0].type, type); parentEditor.blocks.forEach(checkKeys);
}
let originalIds = parentEditor.blocks.map(block => block.id);
parentEditor.render().find(node => node.type === "button" && node.props["aria-label"] === "下へ").props.onClick();
assert.deepEqual(plain(parentEditor.blocks.slice(0, 2).map(block => block.id)), [originalIds[1], originalIds[0]]);
parentEditor.blocks.forEach(checkKeys);
const copied = plain(parentEditor.blocks[0]);
parentEditor.render().find(node => node.type === "button" && node.props["aria-label"] === "複製").props.onClick();
assert.notEqual(parentEditor.blocks[1].id, copied.id);
assert.deepEqual({ ...plain(parentEditor.blocks[1]), id: copied.id }, copied); parentEditor.blocks.forEach(checkKeys);
const count = parentEditor.blocks.length;
parentEditor.render().find(node => node.type === "button" && node.props["aria-label"] === "削除").props.onClick();
assert.equal(parentEditor.blocks.length, count - 1); parentEditor.blocks.forEach(checkKeys);
console.log("PASS: cloud editor preserves strict block fields, private asset IDs, URL paste and IME-safe paragraph splitting");
console.log("PASS: actual parent split, insert, move, duplicate and delete retain publication-compatible keys");
