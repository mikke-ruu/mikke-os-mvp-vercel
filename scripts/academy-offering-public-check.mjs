import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

function load(path, dependencies = {}) {
  const box = { exports: {}, crypto, require(name) { if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`); return dependencies[name]; } };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, box);
  return box.exports;
}
const { offeringPurchaseState } = load('lib/academy/offering-purchase.ts');
const offering = { id: 'o1', headquarters_id: 'hq1', title: '募集の確認', kind: 'コース', currency: 'JPY', payment_methods: ['bank'], lp_blocks: [], courses: [{ id: 'a', name: 'A', price: 900 }, { id: 'b', name: 'B', price: 800 }], purchase_mode: 'staged', course_ids: ['a', 'b'], stage_prices: { a: 100, b: 200 }, price: 300 };
const old = { id: 'app1', offering_id: 'o1', headquarters_id: 'hq1', offering_title: '前の募集名', status: 'paid', price: 100, stage_index: 1, completed_at: null, purchase_snapshot: { course_ids: ['a', 'b'], stage_prices: { a: 100, b: 200 }, payment_methods: ['onsite'], courses: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] } };
assert.equal(offeringPurchaseState(offering, []).amount, 100);
assert.equal(offeringPurchaseState(offering, [old]).blocked, true);
const completed = { ...old, completed_at: '2026-09-18' };
const next = offeringPurchaseState({ ...offering, purchase_mode: 'all', stage_prices: { a: 1000, b: 2000 } }, [completed]);
assert.equal(next.amount, 200, 'Existing stage price must remain snapshotted after HQ changes');
assert.equal(next.stage, 2); assert.equal(next.blocked, false);
assert.equal(offeringPurchaseState(offering, [{ ...old, stage_index: 0, purchase_snapshot: null, price: 700 }]).amount, 700);
assert.equal(offeringPurchaseState(offering, [{ ...old, stage_index: 0, purchase_snapshot: null }]).blocked, true);
assert.equal(offeringPurchaseState(offering, [{ ...old, purchase_snapshot: null }]).blocked, true);
const finished = { ...completed, stage_index: 2 };
assert.equal(offeringPurchaseState(offering, [finished]).complete, true);
const { offeringProblem } = load('lib/academy/offerings.ts', { '@/lib/supabase/client': {}, '@/lib/academy/preview': {} });
assert(offeringProblem({ ...offering, status: 'published', price: 0, payment_methods: [], completion_mode: 'learner' }));

let cursor = 0;
let states = [];
const hooks = { useEffect() {}, useState(initial) { const slot = cursor++; if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial; return [states[slot], next => { states[slot] = typeof next === 'function' ? next(states[slot]) : next; }]; }, useRef(initial) { const slot = cursor++; if (!(slot in states)) states[slot] = { current: initial }; return states[slot]; } };
let calls = [];
let release;
const supabase = { rpc(name, args) { calls.push({ name, args }); return new Promise(resolve => { release = resolve; }); } };
const { PublicOffering } = load('components/academy/PublicOffering.tsx', {
  react: hooks, 'react/jsx-runtime': jsx,
  'next/link': { default: ({ children, ...props }) => jsx.jsx('a', { ...props, children }) },
  '@/lib/supabase/client': { supabase }, '@/lib/academy/access-context': { toAcademyContextHref: value => value },
  './AcademyCourseCard': { AcademyCourseCard: ({ course, hidePrice }) => jsx.jsx('article', { children: `${course.name}${hidePrice ? '' : course.price}` }) },
  './AcademyContentRenderer': { AcademyContentRenderer: () => null },
  '@/components/mikkeos/page-builder/LpDesign': { LpContent: ({ blocks, render }) => render(blocks) },
  '@/lib/academy/offering-purchase': { offeringPurchaseState }
});
function setup(history = [], overrides = {}) {
  states = [offering, null, false, '', true, 'user1', '申込者', 'user@example.com', 'bank', false, null, history, true];
  for (const [key, value] of Object.entries(overrides)) states[Number(key)] = value;
  calls = [];
}
function tree(instructor = false) { cursor = 0; return PublicOffering({ id: 'o1', instructor }); }
function html() { return renderToStaticMarkup(tree()); }
function find(node, predicate) { if (!node || typeof node !== 'object') return null; if (predicate(node)) return node; for (const child of [node.props?.children].flat(Infinity)) { const hit = find(child, predicate); if (hit) return hit; } return null; }
setup(); let markup = html(); assert(markup.includes('¥100')); assert(!markup.includes('¥900')); assert(markup.includes('この内容で申し込む'));
setup([], { 5: null }); assert(html().includes('ログインして申し込む'));
setup([], { 12: false }); assert(html().includes('申込履歴を確認しています'));
setup([finished]); markup = html(); assert(!markup.includes('¥NaN')); assert(!markup.includes('第3講座')); assert(markup.includes('申込は完了'));
setup([completed]); markup = html(); assert(markup.includes('¥200')); assert(markup.includes('現地でお支払い')); assert(!markup.includes('銀行振込'));
setup(); const form = find(tree(), node => node.type === 'form'); assert(form); const first = form.props.onSubmit({ preventDefault() {} }); await form.props.onSubmit({ preventDefault() {} }); assert.equal(calls.length, 1, 'Duplicate submits must be locked'); assert.equal(calls[0].args.p_expected_price, 100); release({ data: { id: 'saved', price: 100, status: 'submitted', headquarters_id: 'hq1', offering_title: '募集の確認' }, error: null }); await first; assert(html().includes('お申し込みを受け付けました'));
setup(); const failing = find(tree(), node => node.type === 'form').props.onSubmit({ preventDefault() {} }); const token = calls[0].args.p_request_token; release({ data: null, error: new Error('network') }); await failing; assert(html().includes('申込の受付を確認できませんでした')); assert.equal(states[6], '申込者'); const retry = find(tree(), node => node.type === 'form').props.onSubmit({ preventDefault() {} }); assert.equal(calls[1].args.p_request_token, token); release({ data: null, error: new Error('network') }); await retry;
setup(); const instructorSubmit = find(tree(true), node => node.type === 'form').props.onSubmit({ preventDefault() {} }); assert.equal(calls[0].name, 'academy_submit_instructor_offering_application'); assert.equal(calls[0].args.p_page_id, 'o1'); assert(!('p_offering_id' in calls[0].args)); release({ data: null, error: new Error('network') }); await instructorSubmit;
console.log('Academy offering purchase + public SSR/submit checks passed');
