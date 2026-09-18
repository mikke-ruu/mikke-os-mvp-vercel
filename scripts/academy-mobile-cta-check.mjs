import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = process.argv[2] || '831d30c55020063b8d370b63f3aea7846e47cf5d';
const files = ['app/academy/c/[id]/page.tsx', 'app/academy/apply/[id]/page.tsx'];
const stripClasses = source => source.replace(/className="[^"]*"/g, 'className="STYLE"');
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const original = execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8' });
  assert.equal(stripClasses(source).replace(/\r\n/g, '\n'), stripClasses(original).replace(/\r\n/g, '\n'), `${file}: only literal CSS classes may change; handlers, payloads, labels and URLs must remain identical`);
}
const course = readFileSync(files[0], 'utf8');
assert.ok(course.includes('mx-auto flex min-h-12 w-full items-center justify-center'));
assert.ok(course.includes('mt-3 flex min-h-12 w-full items-center justify-center'));
assert.ok(course.includes('md:max-w-sm'));
const apply = readFileSync(files[1], 'utf8');
assert.ok(apply.includes('type="submit" disabled={saving} className="min-h-12 w-full'));
assert.ok(apply.includes('text-base! font-bold! leading-6!'));
console.log('PASS: full-width 48px CTA classes; all non-style code matches baseline including URLs, conditions, payment and submission payloads');
