import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

function load(path, dependencies) {
  const box = { exports: {}, crypto, structuredClone, require(name) { if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`); return dependencies[name]; } };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, box);
  return box.exports;
}
const api = load('lib/academy/offerings.ts', { '@/lib/supabase/client': {}, '@/lib/academy/preview': {} });
let states = [], cursor = 0;
const hooks = { useEffect() {}, useState(initial) { const slot = cursor++; if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial; return [states[slot], value => { states[slot] = typeof value === 'function' ? value(states[slot]) : value; }]; }, useRef(initial) { const slot = cursor++; if (!(slot in states)) states[slot] = { current: initial }; return states[slot]; } };
const empty = () => null;
const { OfferingEditor } = load('components/academy/OfferingEditor.tsx', {
  react: hooks, 'react/jsx-runtime': jsx, 'next/link': { default: ({ children, ...props }) => jsx.jsx('a', { ...props, children }) },
  '@/lib/academy/access-context': { toCurrentAcademyContextHref: value => value }, '@/lib/academy/offerings': api,
  './AcademyCourseCard': { AcademyCourseCard: empty }, './AcademyContentRenderer': { AcademyContentRenderer: empty }, './AcademyImageUploader': { AcademyImageUploader: empty },
  '@/components/mikkeos/page-builder/LpCanvas': { LpCanvas: empty }, '@/components/mikkeos/page-builder/LpDesign': { LpDesignFields: empty },
  '@/components/mikkeos/page-builder/LpGalleryFields': { LpGalleryFields: empty }, '@/components/mikkeos/page-builder/LpRichWriting': { LpRichWriting: empty }, '@/components/mikkeos/content/MikkeBlockFields': { MikkeBlockFields: empty }
});
function find(node, predicate) { if (!node || typeof node !== 'object') return null; if (predicate(node)) return node; for (const child of [node.props?.children].flat(Infinity)) { const found = find(child, predicate); if (found) return found; } return null; }
const initial = { ...api.blankOfferingInput(), id: 'o1', title: '修了後の期限がある募集', price: 100, course_ids: ['c1'], status: 'published' };
async function check(isPublished, expectedSaves) {
  states = []; let saved = 0;
  const props = { initial, courses: [{ id: 'c1', name: '講座', is_published: isPublished, learner_access_mode: 'days_after_completion', learner_access_days: 30 }], onSave: async value => { saved++; return { ...initial, ...value }; } };
  const render = () => { cursor = 0; return OfferingEditor(props); };
  const button = find(render(), node => node.type === 'button' && node.props.children === '保存する');
  assert(button); await button.props.onClick(); assert.equal(saved, expectedSaves);
  states[1] = 2;
  const html = renderToStaticMarkup(render());
  assert(!html.includes('未対応')); assert(!html.includes('まだ受け付けられません'));
  assert.equal(html.includes('公開前に確認する講座'), !isPublished);
  if (!isPublished) assert(html.includes('公開前に講座の公開状態を確認してください。'));
}
await check(true, 1);
await check(false, 0);
console.log('Offering editor allows published completion-days courses and blocks unpublished courses');
