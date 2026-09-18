import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function load(path, dependencies) {
  const box = { exports: {}, crypto, requestAnimationFrame: callback => callback(), require: name => {
    if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
    return dependencies[name];
  } };
  vm.runInNewContext(ts.transpileModule(source(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, box);
  return box.exports;
}
const { createAcademyDraftInput } = load('lib/academy/draft-input.ts', {});
const basic = () => null;
let cursor = 0;
const state = [];
const hooks = {
  useState(initial) {
    const slot = cursor++;
    if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial;
    return [state[slot], value => { state[slot] = typeof value === 'function' ? value(state[slot]) : value; }];
  },
  useRef(initial) {
    const slot = cursor++;
    if (!(slot in state)) state[slot] = { current: initial };
    return state[slot];
  }
};
const { CourseForm } = load('app/academy/courses/CourseForm.tsx', {
  react: hooks, 'react/jsx-runtime': jsx,
  'lucide-react': { Plus: basic, Trash2: basic },
  '@/components/academy/AcademyHelp': { AcademyHelp: basic },
  '@/components/academy/AcademyImageUploader': { AcademyImageUploader: basic },
  '@/components/academy/AcademyCourseInput': { AcademyCourseInput: basic },
  '@/components/academy/AcademyCourseCard': { AcademyCourseCard: basic },
  '@/components/academy/AcademyRolePreview': { AcademyRolePreview: basic },
  '@/lib/academy/course-feature-settings': { DEFAULT_ACADEMY_COURSE_FEATURE_SETTINGS: {} },
  '@/lib/academy/course-save-errors': { getAcademyCourseSaveErrorMessage: error => error.message }
});
function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return null;
}
const original = { ...createAcademyDraftInput('既存講座', '4500'),
  paymentProvider: 'stripe', paymentUrl: 'https://example.com/payment',
  learnerAccessMode: 'days_after_completion', learnerAccessDays: 123,
  faq: [{ q: '既存質問', a: '既存回答', future: 'keep' }],
  applicationFormFields: [{ key: 'existing', label: '質問', type: 'text', required: true }],
  futureField: { keep: 'unknown payload' }, materialContents: '旧教材', kitContents: '講師用キット'
};
let calls = [];
let nextCalls = [];
let save = async input => calls.push(input);
let next = async input => nextCalls.push(input);
function render() { cursor = 0; return CourseForm({ initial: original, submitLabel: '保存', onSubmit: input => save(input), onNext: input => next(input) }); }
const event = isNext => ({ preventDefault() {}, nativeEvent: { submitter: { getAttribute: () => isNext ? 'true' : null } } });
let tree = render();
const basicFields = find(tree, node => node.type === basic && node.props.onChange && node.props.value?.name);
assert.ok(basicFields, 'simple course inputs exist');
basicFields.props.onChange('name', '変更した講座');
tree = render();
await tree.props.onSubmit(event(false));
assert.equal(calls.length, 1);
assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), { ...JSON.parse(JSON.stringify(original)), name: '変更した講座' });
assert.equal(original.name, '既存講座', 'source is not mutated');
tree = render();
await tree.props.onSubmit(event(true));
assert.equal(nextCalls.length, 1);
assert.equal(calls.length, 1, 'next uses a single save/navigation callback');
next = async () => { throw new Error('保存失敗'); };
await render().props.onSubmit(event(true));
assert.ok(find(render(), node => node.props?.role === 'alert'), 'failed save stays in form with an error');
let release;
let inFlightCalls = 0;
save = async () => { inFlightCalls += 1; return new Promise(resolve => { release = resolve; }); };
tree = render();
const first = tree.props.onSubmit(event(false));
await tree.props.onSubmit(event(false));
assert.ok(release, 'first submission started');
assert.equal(inFlightCalls, 1, 'double clicks cannot create two courses');
release();
await first;
const edited = find(render(), node => node.type === basic && node.props.onChange && node.props.value?.name);
edited.props.onChange('price', Number.NaN);
let invalidSaved = false;
save = async () => { invalidSaved = true; };
await render().props.onSubmit(event(false));
assert.equal(invalidSaved, false, 'empty price cannot silently become free');
const newPage = source('app/academy/courses/new/page.tsx');
assert.ok(newPage.includes('if (!createAccess?.allowed)'), 'creation gate remains');
assert.ok(newPage.includes('getMyAcademyCourseCreationAccess'));
for (const path of ['app/academy/courses/new/page.tsx', 'app/academy/courses/[id]/page.tsx']) {
  const page = source(path);
  const handler = page.slice(page.indexOf('onNext={async'));
  assert.ok(/await (createCourse|updateCourse)/.test(handler));
  assert.ok(handler.indexOf('await ') < handler.indexOf('router.push('), 'navigate only after successful save');
  assert.ok(handler.includes('/instructor-page?audience=learner'));
}
console.log('PASS: basic edits preserve full payload, unknown fields, payment/FAQ/access settings; failed save and empty price stay on form; double submit is guarded; existing creation gate and save-before-lesson navigation remain.');
