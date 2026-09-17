import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, dependencies = {}) {
  const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const box = { exports: {}, structuredClone, crypto, URL, require: name => { if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`); return dependencies[name]; } };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, box);
  return box.exports;
}
const { academyContent, contentToAcademy, replaceAcademyContent } = load('lib/academy/content-adapter.ts');
const { lpBackground } = load('components/mikkeos/page-builder/lp-design.ts');
const { saveAcademyLpContent } = load('lib/academy/lp-content-adapter.ts', { './content-adapter': { academyContent, contentToAcademy } });
const legacy = [
  { type: 'heading', text: '既存の見出し' },
  { type: 'text', text: '既存の紹介文' },
  { type: 'image', url: 'https://example.com/old.jpg', caption: '既存画像', linkUrl: 'https://example.com' },
  { type: 'cta', heading: '申込', buttonLabel: '申し込む', buttonUrl: '/academy/apply/original-id' },
];
const before = JSON.stringify(legacy);
const initial = academyContent(legacy);
const section = { id: 'section-1', type: 'paragraph', lp: { desktop: { padding: 16, background: '#ffffff' }, mobile: { size: 16 }, children: [
  { id: 'title-1', type: 'heading', text: '新しい本文', richText: [{ text: '新しい本文', bold: true }] },
  { id: 'gallery-1', type: 'gallery', images: [{ url: 'https://example.com/photo.jpg', alt: '写真' }], lp: { slideshow: true, autoplay: true } },
] } };
const content = [...initial, section];
const roundTrip = academyContent(JSON.parse(JSON.stringify(contentToAcademy(content))));
assert.equal(JSON.stringify(roundTrip), JSON.stringify(content));
assert.equal(JSON.stringify(legacy), before);
assert.equal(roundTrip[3].url, '/academy/apply/original-id');
assert.equal(roundTrip[4].lp.children[1].lp.autoplay, true);
const materials = replaceAcademyContent([{ type: 'materials-list' }, ...legacy], content);
assert.equal(materials[0].type, 'materials-list');
assert.equal(lpBackground('javascript:alert(1)'), undefined);
assert.equal(lpBackground('https://user:password@example.com/x'), undefined);
assert.ok(lpBackground('https://example.com/image.jpg').startsWith('url('));
assert.equal(lpBackground('bad-url'), undefined);
const extended = [{ ...legacy[0], extensionForFuture: { retained: true } }, ...legacy.slice(1)];
const preserved = saveAcademyLpContent(extended, content);
assert.equal(preserved[0].extensionForFuture.retained, true);
assert.ok(preserved.at(-1).text.includes('新しい本文'));
assert.ok(preserved.at(-1).text.includes('https://example.com/photo.jpg'));
assert.equal(preserved.at(-1).content.text, preserved.at(-1).text);
assert.equal(JSON.stringify(academyContent(preserved).at(-1).lp), JSON.stringify(section.lp));
assert.equal(JSON.stringify(academyContent(preserved).slice(0, -1)), JSON.stringify(initial));
console.log('PASS: legacy fields, stable IDs, nested LP styles, slideshow and material placeholders survive JSON round trips; unsafe backgrounds rejected.');
