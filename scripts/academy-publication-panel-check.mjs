import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(name => name === './AcademyHelp'
    ? load('components/academy/AcademyHelp.tsx') : require(name), module, module.exports);
  return module.exports;
}
const { AcademyPublicationPanel } = load('components/academy/AcademyPublicationPanel.tsx');
const course = { id: 'sample', name: '<保存済みの講座>', price: 12345, is_published: false };
let calls = 0;
const render = sample => renderToStaticMarkup(React.createElement(AcademyPublicationPanel, {
  course, sample, onChange: async () => { calls++; }
}));
const previous = process.env.NODE_ENV;
try {
  process.env.NODE_ENV = 'development';
  const preview = render(true);
  assert.match(preview, /data-academy-local-publication="true"/);
  assert.match(preview, /&lt;保存済みの講座&gt;/);
  assert.match(preview, /12,345/);
  assert.match(preview, /Academyの月額料金ではありません/);
  assert.match(preview, /disabled=""[^>]*>見本の表示を切り替える/);
  assert.match(preview, /\/academy\/flow-review/);
  process.env.NODE_ENV = 'production';
  for (const sample of [false, true]) {
    const html = render(sample);
    assert.doesNotMatch(html, /data-academy-local-publication|href="\/academy\/flow-review"/);
  }
  assert.equal(calls, 0);
  const edit = readFileSync('app/academy/courses/[id]/page.tsx', 'utf8');
  assert.match(edit, /if \(isAcademyLocalReview\(\)\) \{[\s\S]*?setCourse\([\s\S]*?return;[\s\S]*?setCoursePublished/);
  const shell = readFileSync('components/academy/AcademyShell.tsx', 'utf8');
  assert.match(shell, /localPublication = process.env.NODE_ENV === "development" && !accessLocked/);
  console.log('academy_publication_panel_ok: saved summary, confirmation disabled, escaping, development isolation, zero render mutations');
} finally {
  if (previous === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previous;
}
