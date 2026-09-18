import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the sheet's visibility lifecycle without touching tenant data.
const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../components/mikkeos/page-builder/LpCanvas.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../components/mikkeos/page-builder/lp-canvas.module.css', import.meta.url), 'utf8');
const states = [true, false, true, 'heading'];
const refs = [];
let stateIndex, refIndex, effects, callback, observed, disconnected;
const react = {
  useId: () => 'test',
  useState(initial) {
    const index = stateIndex++;
    if (!(index in states)) states[index] = initial;
    return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
  },
  useRef(initial) { return refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial }); },
  useEffect(effect) { effects.push(effect); },
};
const block = { id: 'heading', type: 'heading', text: '末尾の見出し' };
const box = { exports: {}, IntersectionObserver: class {
  constructor(cb) { callback = cb; }
  observe(node) { observed = node; }
  disconnect() { disconnected = true; }
}, require: name => {
  if (name === 'react') return react;
  if (name === 'react/jsx-runtime') return require(name);
  if (name === './lp-canvas') return { findLpBlock: () => block, sectionChoices: [] };
  if (name.endsWith('.module.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
  return new Proxy({}, { get: (_, key) => key });
} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, box);
function render() {
  stateIndex = refIndex = 0; effects = [];
  return box.exports.LpCanvas({ blocks: [block], onChange() {}, renderContent() {}, renderFields() {}, title: '確認' });
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => find(child, predicate));
  return [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)];
}
const panels = tree => find(tree, node => node.type === 'aside');
let tree = render();
assert.equal(panels(tree).length, 1);
assert.equal(panels(tree)[0].props['data-active'], true);
const stage = find(tree, node => node.props?.className === 'stage')[0];
stage.props.ref.current = { id: 'stage' };
const cleanup = effects[0]();
assert.equal(observed.id, 'stage');
callback([{ isIntersecting: false }]);
assert.equal(panels(render())[0].props['data-active'], false);
panels(render())[0].props.onFocusCapture();
assert.equal(panels(render())[0].props['data-active'], true, 'keyboard focus must keep the sheet visible');
panels(render())[0].props.onBlurCapture({ currentTarget: { contains: () => false }, relatedTarget: null });
assert.equal(panels(render())[0].props['data-active'], false);
callback([{ isIntersecting: true }]);
assert.equal(panels(render())[0].props['data-active'], true);
cleanup();
assert.equal(disconnected, true);
states[0] = false; states[2] = false;
assert.equal(panels(render())[0].props['data-active'], true, 'desktop inspector must not depend on mobile stage visibility');
states[6] = true;
assert.equal(panels(render()).length, 0, 'preview has no inspector');
assert.ok(css.includes('.root[data-mobile-sheet=true] .stage{padding-bottom:'));
assert.ok(css.lastIndexOf('font-size:16px') > css.lastIndexOf('font-size:14px'));
console.log('PASS: single inspector, mobile off-canvas hide/restore, observer cleanup, desktop visibility, preview hiding and trailing mobile CSS overrides.');
