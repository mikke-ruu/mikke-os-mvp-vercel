import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
function load(path) {
  const module = { exports: {} };
  new Function('module','exports','require',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText)(module,module.exports,name => name === './AcademyCommunityInvitations' ? {AcademyCommunityInvitations:()=>null} : name === 'next/link' ? {default:({children,...props})=>React.createElement('a',props,children)} : name === '@/lib/academy/access-context' ? {toCurrentAcademyContextHref: value=>value} : require(name));
  return module.exports;
}
const { applicationIntakeCounts, matchesIntake } = load('lib/academy/intake-summary.ts');
const apps = [{intake_source:'honbu'},{intake_source:'koushi'},{intake_source:'koushi'}];
assert.deepEqual(applicationIntakeCounts(apps), {all:3,honbu:1,instructor:2});
assert.equal(apps.filter(a=>matchesIntake(a,'koushi')).length,2);
assert.equal(apps.filter(a=>matchesIntake(a,'honbu')).length,1);
assert.equal(apps.filter(a=>matchesIntake(a,'all')).length,3);
const { academyReviewReturn:r } = load('lib/academy/review-navigation.ts');
const source='/academy/h/00000000-0000-4000-8000-000000000001/manage/instructors?preview=walkthrough';
assert.equal(r(source),source);
assert.equal(r('/academy/settings?preview=walkthrough'),'/academy/settings?preview=walkthrough');
for(const value of ['https://evil.example','//evil.example','/academy/../../login','/academy/settings/evil','/academy/settings\\evil', ['x']]) assert.equal(r(value),null);
assert.equal(r('/academy/settings?next=https://evil.example'),'/academy/settings');
const page=readFileSync('app/academy/applications/page.tsx','utf8');
assert.ok(page.includes('new URLSearchParams(query.toString())'));
assert.ok(page.includes('0件ではありません'));
const { AcademyCommunityOverview }=load('components/academy/AcademyCommunityOverview.tsx');
const previous=process.env.NODE_ENV;
try {
  process.env.NODE_ENV='development';
  const sample=renderToStaticMarkup(React.createElement(AcademyCommunityOverview,{sample:true,links:[],unavailable:true}));
  assert.ok(sample.includes('契約中（見本）') && sample.includes('サンプル先生A'));
  process.env.NODE_ENV='production';
  const real=renderToStaticMarkup(React.createElement(AcademyCommunityOverview,{sample:true,links:[],unavailable:true}));
  assert.ok(!real.includes('契約中（見本）') && !real.includes('サンプル先生A'));
  assert.ok(real.includes('未契約や0名という意味ではありません'));
} finally { if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous; }
console.log('academy_feedback_ok: intake counts, source isolation, safe return navigation, preview query preservation');
