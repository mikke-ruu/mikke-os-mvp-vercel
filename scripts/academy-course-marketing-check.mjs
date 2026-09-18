import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

function load(path, dependencies = {}, globals = {}) {
  const box = { exports: {}, crypto, ...globals, require(name) { if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`); return dependencies[name]; } };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, box);
  return box.exports;
}
const marketing = { category: 'アクセサリー', images: ['https://example.com/first.png', 'https://example.com/second.png'], curriculum: ['道具を知る', '作品をつくる'], imageSide: 'right', futureField: { keep: true } };
const helpers = load('lib/academy/course-marketing.ts');
assert.equal(helpers.courseMarketing(marketing).category, marketing.category);
assert.equal(helpers.courseMarketing(marketing).futureField, undefined);
assert.equal(helpers.courseMarketing({ images: ['javascript:alert(1)', 'https://example.com/a'] }).images.length, 1);
assert.equal(helpers.courseImages(marketing, 'https://example.com/new-thumbnail.png')[0], 'https://example.com/new-thumbnail.png');
const resolver = load('lib/academy/course-feature-settings.ts');
const { createAcademyDraftInput } = load('lib/academy/draft-input.ts');
let written;
const chain = { update(row) { written = row; return chain; }, eq() { return chain; }, select() { return chain; }, async single() { return { data: { id: 'course1', ...written }, error: null }; } };
const { updateCourse } = load('lib/academy/courses.ts', {
  '@/lib/supabase/client': { supabase: { from(name) { assert.equal(name, 'academy_courses'); return chain; } } },
  '@/lib/academy/events': {}, '@/lib/academy/course-feature-settings': resolver,
  '@/lib/academy/preview': { assertAcademyWritable() {}, isAcademyLocalReview: () => false }
});
const draft = createAcademyDraftInput('講座', '1000');
draft.mainImageUrl = marketing.images[0];
draft.featureSettings = { ...draft.featureSettings, marketing, unknownPrivate: { unchanged: true } };
draft.faq = [{ q: '既存質問', a: '既存回答' }];
await updateCourse({ id: 'p', user_id: 'u' }, 'hq1', 'course1', draft);
assert.deepEqual(JSON.parse(JSON.stringify(written.feature_settings.marketing)), marketing);
assert.equal(written.feature_settings.unknownPrivate.unchanged, true);
assert.equal(written.main_image_url, marketing.images[0]);
assert.equal(written.faq[0].a, '既存回答');

const dependencies = { react: React, 'react/jsx-runtime': jsx, '@/lib/academy/course-marketing': helpers, './academy-course-card.module.css': { default: {} } };
const { AcademyCourseCard } = load('components/academy/AcademyCourseCard.tsx', dependencies);
const course = { name: '講座名', price: 1000, main_image_url: marketing.images[0], marketing };
const html = renderToStaticMarkup(React.createElement(AcademyCourseCard, { course }));
assert(html.includes('アクセサリー')); assert(html.includes('道具を知る')); assert(html.includes('data-image-side="right"')); assert(html.includes('first.png')); assert(html.includes('1枚目の画像')); assert(html.includes('2枚目の画像')); assert(!html.includes('futureField'));
const override = renderToStaticMarkup(React.createElement(AcademyCourseCard, { course, imageSide: 'left', hidePrice: true }));
assert(override.includes('data-image-side="left"')); assert(!override.includes('¥1,000'));
let effect, interval, cleared = false, index = 0;
const timed = load('components/academy/AcademyCourseCard.tsx', { ...dependencies, react: { useState: () => [index, value => { index = typeof value === 'function' ? value(index) : value; }], useEffect: fn => { effect = fn; } } }, { window: { setInterval(callback, ms) { assert.equal(ms, 5000); interval = callback; return 1; }, clearInterval(id) { assert.equal(id, 1); cleared = true; } } });
timed.AcademyCourseCard({ course }); const cleanup = effect(); interval(); assert.equal(index, 1); interval(); assert.equal(index, 0); cleanup(); assert(cleared);
console.log('Academy course marketing lossless save + card SSR + five-second slideshow checks passed');
