const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/academy/lesson-content.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText, {exports:mod.exports});
const {readLessons,writeLessons,moveLesson}=mod.exports;
const json=x=>JSON.parse(JSON.stringify(x));
const original=[{type:'heading',text:'既存の見出し'},{type:'video',url:'https://example.com/movie.mp4'},{type:'materials-list'},{type:'text',text:'本文',contentVersion:1,content:{id:'rich',type:'paragraph',text:'本文',format:'rich'}}];
const legacy=readLessons(original);
assert.equal(legacy.length,1);
assert.deepEqual(json(legacy[0].blocks),original);
const saved=writeLessons(legacy);
assert.deepEqual(json(saved.slice(1)),original);
assert.deepEqual(json(writeLessons(readLessons(saved))),json(saved));
const seeded=readLessons([],['色の三要素','トーン']);
assert.equal(seeded.length,2);
assert.equal(moveLesson(seeded,0,1)[0].title,'トーン');
assert.equal(moveLesson(seeded,0,-1),seeded);
assert.equal(readLessons(writeLessons([])).length,0);
const mixed=readLessons([...original,...writeLessons(seeded)]);
assert.equal(mixed.length,3);
assert.deepEqual(json(mixed[0].blocks),original);
const editor=fs.readFileSync('components/academy/AcademyLessonEditor.tsx','utf8');
assert.match(editor,/AcademyContentEditor/);
assert.match(editor,/aria-expanded/);
assert.match(editor,/window.confirm/);
const page=fs.readFileSync('app/academy/courses/[id]/instructor-page/page.tsx','utf8');
assert.match(page,/saveLearnerPage\(profile, hq.id, course.id, blocks, isPublished\)/);
assert.match(page,/AcademyLessonEditor blocks=\{blocks\} curriculum=\{\[\]\}/);
const study=fs.readFileSync('app/academy/portal/study/page.tsx','utf8');
assert.match(study,/access.state === "active"/);
assert.match(study,/<AcademyLessonContent blocks=\{page.blocks\}/);
console.log('PASS: lesson round-trip, legacy rich/video/material preservation, curriculum seed, reorder, empty deletion, real save and access gate');

// Exercise real editor event handlers without the walkthrough's intentional write-blocking UI.
const react = require('react');
const state=[]; let cursor=0; let value=writeLessons(seeded); let confirm=true;
const component={exports:{}};
const deps={
  react:{useState:initial=>{const index=cursor++;if(!(index in state))state[index]=initial;return [state[index],next=>{state[index]=next;}];}},
  'react/jsx-runtime':require('react/jsx-runtime'),
  'lucide-react':{ArrowDown:'span',ArrowUp:'span',ChevronDown:'span',Plus:'span'},
  '@/lib/academy/lesson-content':mod.exports,
  './AcademyContentEditor':{AcademyContentEditor:'content-editor'},
  './AcademyLessonContent':{AcademyLessonContent:'lesson-preview'},
  './academy-lesson-editor.module.css':{default:new Proxy({},{get:(_,key)=>key})}
};
vm.runInNewContext(ts.transpileModule(editor,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:component.exports,require:id=>deps[id],crypto:{randomUUID:()=> 'new-lesson'},window:{confirm:()=>confirm}});
const render=()=>{cursor=0;return component.exports.AcademyLessonEditor({blocks:value,curriculum:[],onChange:next=>{value=next;}});};
function nodes(tree){if(!react.isValidElement(tree))return [];return [tree,...react.Children.toArray(tree.props.children).flatMap(nodes)];}
let tree=render();
nodes(tree).find(n=>n.type==='button'&&n.props['aria-controls']==='lesson-curriculum-0').props.onClick();
tree=render();
nodes(tree).find(n=>n.type==='input').props.onChange({target:{value:'改訂レッスン'}});
assert.equal(readLessons(value)[0].title,'改訂レッスン');
tree=render();
nodes(tree).find(n=>n.type==='content-editor').props.onChange(original);
assert.deepEqual(json(readLessons(value)[0].blocks),original);
tree=render();
nodes(tree).find(n=>n.type==='button'&&n.props.className==='add').props.onClick();
assert.equal(readLessons(value).length,3);
tree=render(); confirm=false;
nodes(tree).find(n=>n.type==='button'&&n.props.children==='レッスンを削除').props.onClick();
assert.equal(readLessons(value).length,3);
confirm=true;
nodes(tree).find(n=>n.type==='button'&&n.props.children==='レッスンを削除').props.onClick();
assert.equal(readLessons(value).length,2);
assert.deepEqual(json(readLessons(value)[0].blocks),original);
console.log('PASS: real editor handlers expand, rename, edit body, add, cancel deletion and remove without losing other lessons');
