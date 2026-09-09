import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function load(file, require = () => { throw new Error('Unexpected runtime import'); }) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const module = { exports: {} };
  new Function('module', 'exports', 'require', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(module, module.exports, require);
  return module.exports;
}
const { createAcademyDraftInput: draft } = load('lib/academy/draft-input.ts');
for (const [name, price] of [['', '100'], ['   ', '100'], ['a', ''], ['a', ' '], ['a', '-1'], ['a', '1.5'], ['a', 'NaN'], ['a', 'Infinity'], ['a', '9007199254740992']]) assert.throws(() => draft(name, price));
const input = draft('  講座名  ', '5000');
assert.equal(input.name, '講座名');
assert.equal(input.price, 5000);
assert.equal(draft('無料講座', '0').price, 0);
assert.notEqual(input.code, draft('講座名', '5000').code);
assert.equal(input.paymentProvider, 'manual');
assert.equal(input.paymentUrl, '');
assert.equal(input.featureSettings.materialLicenses, false);
assert.equal(input.featureSettings.certification, false);
assert.equal(input.featureSettings.subscriptions, false);
assert.equal(input.acceptAtKoushi, false);
const { resolveAcademyCourseFeatureSettings } = load('lib/academy/course-feature-settings.ts');
let inserted;
let insertCount = 0;
const saved = { id: 'saved-course', is_published: false };
const { createCourse } = load('lib/academy/courses.ts', name => {
  if (name.endsWith('/supabase/client')) return { supabase: { from(table) { assert.equal(table, 'academy_courses'); return { insert(row) { inserted = row; insertCount++; return { select() { return { async single() { return { data: saved, error: null }; } }; } }; } }; } } };
  if (name.endsWith('/events')) return { logAcademyEvent: async () => { throw new Error('auxiliary event failure'); } };
  if (name.endsWith('/course-feature-settings')) return { resolveAcademyCourseFeatureSettings };
  if (name.endsWith('/preview')) return { assertAcademyWritable() {} };
  throw new Error(`Unexpected import ${name}`);
});
assert.equal(await createCourse({ user_id: 'owner', id: 'profile' }, 'hq', input), saved);
assert.equal(insertCount, 1);
assert.equal(inserted.is_published, false);
assert.equal(inserted.user_id, 'owner');
assert.equal(inserted.headquarters_id, 'hq');
assert.equal(inserted.price, 5000);
console.log('academy_beginner_draft_contract_ok: validation, explicit free price, private insert, owner scope, auxiliary failure');
