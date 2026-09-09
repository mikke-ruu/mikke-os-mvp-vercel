import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
function load(path, dependencies={}) {
  const module={exports:{}};
  new Function('module','exports','require',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText)(module,module.exports,name=>dependencies[name]??require(name));
  return module.exports;
}
const {default:Page}=load('app/academy/first-publication-review/page.tsx',{'next/navigation':{notFound(){throw Error('not-found');}},'./review':{FirstPublicationReview:()=>React.createElement('div',null,'development-only')}});
const before=process.env.NODE_ENV;
try {
  for(const env of ['production','test']) {process.env.NODE_ENV=env;assert.throws(()=>Page(),/not-found/);}
  process.env.NODE_ENV='development';assert.ok(renderToStaticMarkup(Page()).includes('development-only'));
} finally {if(before===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=before;}
const {firstPublicationReviewFixture:fixture,FirstPublicationReview:Review}=load('app/academy/first-publication-review/review.tsx',{'@/components/academy/AcademyFirstPublicationPanel':{AcademyFirstPublicationPanel:()=>React.createElement('div',null,'real-panel-slot')}});
const now=Date.parse('2026-09-08T00:00:00Z');
assert.equal(fixture('prepared',now).status.firstPublishedAt,null);
assert.equal(fixture('prepared',now).course.is_published,false);
for(const mode of ['trialing','cancelled','paid']) {const f=fixture(mode,now);assert.equal(Date.parse(f.status.trialEndsAt)-Date.parse(f.status.firstPublishedAt),168*3600000);}
assert.equal(fixture('cancelled',now).access.inviteAllowed,false);
assert.equal(fixture('paid',now).access.phase,'paid');
assert.ok(Date.parse(fixture('paid',now).access.endsAt)>now);
const html=renderToStaticMarkup(React.createElement(Review,{startedAt:now}));assert.ok(html.includes('架空データ')&&html.includes('実際の講座公開')&&html.includes('real-panel-slot'));
const source=readFileSync('app/academy/first-publication-review/review.tsx','utf8');
assert.ok(!/\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b|from ["'][^"']*supabase/.test(source));
assert.ok(source.includes('stored.current = next'));
assert.ok(source.includes('local_simulated_after_save'));
console.log('academy_first_publication_review_ok: non-development 404 guard, four fixtures, local-only fault simulation, SSR (no external calls)');
