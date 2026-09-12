import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = readFileSync('lib/mikkeos/story-profile-store.ts', 'utf8');
const storage = new Map();
globalThis.window = {
  localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  dispatchEvent() {}
};
const store = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
const previous = { ...store.defaultStoryProfile, displayName: 'Account A', bio: 'Private draft A', isPublished: true };
storage.set(store.storyProfileStorageKey, JSON.stringify(previous));
storage.set('mikkeos.story.profile.v2', JSON.stringify(previous));
assert.equal(store.loadStoryProfileDraft('B').displayName, '');
assert.equal(store.loadStoryProfileDraft('B').isPublished, false);
store.saveStoryProfileDraft('A', previous);
assert.equal(store.loadStoryProfileDraft('B').bio, '');
store.saveStoryProfileDraft('B', { ...store.defaultStoryProfile, displayName: 'Account B' });
assert.equal(store.loadStoryProfileDraft('A').bio, 'Private draft A');
assert.equal(store.loadStoryProfileDraft('B').displayName, 'Account B');
storage.set(`${store.storyProfileStorageKey}:C`, 'broken json');
assert.equal(store.loadStoryProfileDraft('C').displayName, '');
assert.throws(() => store.saveStoryProfileDraft('', previous));
console.log('PASS: legacy drafts ignored; A/B drafts isolated; malformed and missing identities fail closed');
