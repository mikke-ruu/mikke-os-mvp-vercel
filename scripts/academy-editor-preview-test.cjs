const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
function load(relative) {
  if (relative.endsWith('.css')) return new Proxy({}, { get: (_, key) => key });
  let filename = path.join(root, relative);
  if (!fs.existsSync(filename)) filename = ['.tsx', '.ts', '.js'].map(ext => filename + ext).find(fs.existsSync);
  const source = fs.readFileSync(filename, 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, reportDiagnostics: true });
  assert.equal((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, relative);
  const module = { exports: {} };
  const localRequire = name => name.startsWith('@/') ? load(name.slice(2)) : name.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(filename), name))) : require(name);
  new Function('require', 'module', 'exports', result.outputText)(localRequire, module, module.exports);
  return module.exports;
}
const { safeImageLink, LinkedImage } = load('components/academy/LinkedImage.tsx');
for (const value of ['', 'javascript:alert(1)', 'data:text/html,test', '//example.com', 'file:///test', 'not a url']) assert.equal(safeImageLink(value), undefined);
assert.equal(safeImageLink(' https://example.com/item '), 'https://example.com/item');
assert.equal(safeImageLink('http://example.com/item'), 'http://example.com/item');
const { PageBlocks } = load('components/academy/PageBlocks.tsx');
const blocks = [
  {type:'image', url:'https://example.com/a.png', caption:'材料', linkUrl:'https://example.com/item'},
  {type:'gallery', images:[{url:'https://example.com/b.png', linkUrl:'https://example.com/b'}]},
  {type:'image-text', imageUrl:'https://example.com/c.png', text:'説明', linkUrl:'https://example.com/c'},
];
const html = renderToStaticMarkup(React.createElement(PageBlocks, {blocks}));
assert.equal((html.match(/<a /g) || []).length, 3);
assert.ok(html.includes('noopener noreferrer'));
const legacy = renderToStaticMarkup(React.createElement(LinkedImage, {src:'https://example.com/a.png'}));
assert.ok(!legacy.includes('<a '));
const invalid = renderToStaticMarkup(React.createElement(LinkedImage, {src:'https://example.com/a.png',linkUrl:'javascript:alert(1)'}));
assert.ok(!invalid.includes('<a '));
const { EditorPreview } = load('components/academy/EditorPreview.tsx');
const preview = renderToStaticMarkup(React.createElement(EditorPreview, {preview: '未保存の本文'}, '編集中'));
assert.ok(preview.includes('未保存の本文'));
assert.ok(preview.includes('編集中にプレビューで確認できます。'));
assert.ok(!preview.includes('仕上がりを確認'));
for (const file of ['components/academy/ManualResources.tsx','components/academy/ManualResourceForm.tsx','app/academy/courses/[id]/instructor-page/page.tsx','components/academy/LpBlocksEditor.tsx','app/academy/portal/study/page.tsx','app/academy/c/[id]/page.tsx']) {
  const result = ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'), {compilerOptions:{jsx:ts.JsxEmit.ReactJSX}, reportDiagnostics:true});
  assert.equal((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length,0,file);
}
console.log('PASS: safe image links, image/gallery/image-text rendering, legacy compatibility, unsaved preview, TSX syntax');
