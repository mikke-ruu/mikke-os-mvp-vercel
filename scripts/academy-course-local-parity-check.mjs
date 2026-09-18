import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
function load(path, deps) { const box = { exports: {}, crypto, require(name) { if (!(name in deps)) throw new Error(name); return deps[name]; } }; vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, box); return box.exports; }
let state = [], cursor = 0;
const hooks = { useState(initial) { const slot = cursor++; if (!(slot in state)) state[slot] = initial; return [state[slot], value => state[slot] = value]; }, useRef(initial) { const slot = cursor++; if (!(slot in state)) state[slot] = { current: initial }; return state[slot]; } };
const styles = { default: {} };
function find(node, test) { if (!node || typeof node !== 'object') return null; if (test(node)) return node; for (const child of [node.props?.children].flat(Infinity)) { const hit = find(child, test); if (hit) return hit; } return null; }
const marketing = load('lib/academy/course-marketing.ts', {});
const { createAcademyDraftInput } = load('lib/academy/draft-input.ts', {});
const Images = () => null;
const { AcademyCourseInput } = load('components/academy/AcademyCourseInput.tsx', { react: hooks, 'react/jsx-runtime': jsx, './academy-course-input.module.css': styles, './AcademyCourseImages': { AcademyCourseImages: Images }, '@/lib/academy/course-marketing': marketing });
let value = createAcademyDraftInput('講座', '3000'); value.materialContents = '元のキット'; value.featureSettings = { ...value.featureSettings, unknown: 'keep', marketing: { curriculum: ['最初'], unknown: 'keep' } };
function render() { cursor = 0; return AcademyCourseInput({ value, onChange(key, next) { value = { ...value, [key]: next }; } }); }
find(render(), n => n.type === 'button' && n.props.children === '＋ カリキュラムを追加').props.onClick();
assert.equal(value.featureSettings.marketing.curriculum.length, 2);
find(render(), n => n.props['aria-label'] === 'カリキュラム 2').props.onChange({ target: { value: '次の内容' } });
assert.equal(value.featureSettings.marketing.curriculum[1], '次の内容');
assert.equal(value.featureSettings.marketing.unknown, 'keep'); assert.equal(value.featureSettings.unknown, 'keep');
find(render(), n => n.type === 'input' && n.props.type === 'checkbox').props.onChange({ target: { checked: false } }); assert.equal(value.materialContents, ''); assert.equal(value.featureSettings.kits, false);
find(render(), n => n.type === 'input' && n.props.type === 'checkbox').props.onChange({ target: { checked: true } }); assert.equal(value.materialContents, '元のキット');
find(render(), n => n.type === Images).props.onChange(['https://example.com/one', 'https://example.com/two']); assert.equal(value.mainImageUrl, 'https://example.com/one'); assert.equal(value.featureSettings.marketing.images[1], 'https://example.com/two');
const Uploader = () => null;
const { AcademyCourseImages } = load('components/academy/AcademyCourseImages.tsx', { react: hooks, 'react/jsx-runtime': jsx, './academy-course-input.module.css': styles, './AcademyImageUploader': { AcademyImageUploader: Uploader } });
state = []; let images = ['a', 'b']; const imageRender = () => { cursor = 0; return AcademyCourseImages({ images, onChange(next) { images = next; } }); };
assert.equal(find(imageRender(), n => n.type === Uploader), null, 'Media picker must not be squeezed into thumbnail row');
find(imageRender(), n => n.type === 'button' && n.props.children === '画像変更').props.onClick(); assert(find(imageRender(), n => n.type === Uploader));
find(imageRender(), n => n.type === Uploader).props.onUploaded('changed'); assert.equal(images[0], 'changed');
find(imageRender(), n => n.props['aria-label'] === '画像1を次へ').props.onClick(); assert.equal(images[0], 'b');
find(imageRender(), n => n.type === 'button' && n.props.children === '画像削除').props.onClick(); assert.equal(images.length, 1);
images = Array.from({ length: 6 }, (_, index) => String(index)); assert.equal(find(imageRender(), n => n.type === 'button' && n.props.children === '＋ 画像を追加'), null);
const css = readFileSync(new URL('../components/academy/academy-course-input.module.css', import.meta.url), 'utf8'); assert(css.includes('grid-template-columns:160px minmax(0,1fr)')); assert(css.includes('white-space:nowrap'));
console.log('Course local parity inputs, kit restore, curriculum, image controls and thumbnail sync passed');
