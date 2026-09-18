const fs=require('node:fs');
const assert=require('node:assert/strict');
const read=path=>fs.readFileSync(path,'utf8');
const form=read('app/academy/courses/CourseForm.tsx');
assert.ok(form.includes('<AcademyCourseInput'));
for(const old of ['開催方法・申込・教材の詳細設定','講座づくりの道順','data-course-step','advancedRef','FaqEditor','FormFieldEditor']) assert.ok(!form.includes(old),old);
assert.ok(!read('app/academy/courses/[id]/page.tsx').includes('AcademyCoursePublication'));
const workspace=read('components/academy/AcademyCourseWorkspace.tsx');
assert.ok(!workspace.includes('これまでの'));
assert.ok(!workspace.includes('href("/lp")'));
assert.ok(workspace.includes('講師マニュアル'));
for(const path of ['app/academy/c/[id]/page.tsx','app/academy/apply/[id]/page.tsx']) {
  const source=read(path);assert.ok(source.includes('AcademyRetiredPage'));assert.ok(!source.includes('submitPublicApplication'));
}
for(const path of ['app/academy/courses/[id]/lp/page.tsx','app/academy/courses/[id]/program/page.tsx','app/academy/applications/new/page.tsx']) assert.ok(read(path).includes('AcademyRenewalRedirect'));
for(const path of ['app/academy/site/page.tsx','app/academy/i/[id]/page.tsx']) {assert.ok(!read(path).includes('/academy/c/'));assert.ok(!read(path).includes('/academy/apply/'));}
assert.ok(read('app/academy/kits/page.tsx').includes('tab=koushi'),'kit operations remain reachable');
assert.ok(read('components/academy/AcademyStudioHome.tsx').includes('/academy/kits'));
assert.ok(read('app/academy/settings/page.tsx').includes('export default'),'HQ settings remain');
console.log('PASS: duplicate course wizard/publication removed; old public forms retired; old editors redirected; guide updated; kit operations and HQ settings retained');
