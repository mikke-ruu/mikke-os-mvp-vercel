"use client";
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {LessonNoteEditor} from './LessonNoteEditor';
import {readLessons,writeLessons,moveLesson} from '@/lib/academy/lesson-content';
import type {AcademyPageBlock} from '@/types/database';
/** Separate plan-owned manual content. Never writes learner course blocks. */
export function InstructorManualEditor({reviewContext=false,blocks,onChange,onSave,onClose}:{reviewContext?:boolean;blocks:AcademyPageBlock[];onChange:(v:AcademyPageBlock[])=>void;onSave:()=>Promise<unknown>;onClose:()=>void}){
 const [selected,setSelected]=useState(''),[saving,setSaving]=useState(false),[error,setError]=useState(''),[dirty,setDirty]=useState(false);
 const lessons=readLessons(blocks),lesson=lessons.find(x=>x.id===selected)??lessons[0];
 useEffect(()=>{const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old;};},[]);
 function change(next:AcademyPageBlock[]){onChange(next);setDirty(true);setError('');}
 function add(){const id=crypto.randomUUID();change(writeLessons([...lessons,{id,title:'新しいマニュアル',blocks:[]} ]));setSelected(id);}
 async function save(){if(saving)return;setSaving(true);setError('');try{const result=await onSave();if(!result)throw new Error('保存できませんでした。販売プランの入力とエラーを確認してください。');setDirty(false);}catch(e){setError(e instanceof Error?e.message:'保存できませんでした。')}finally{setSaving(false);}}
 const close=()=>{if(!saving&&(!dirty||window.confirm('マニュアルに未保存の変更があります。設定画面に戻りますか？')))onClose();};
 const editor=<div role="dialog" aria-modal="true" aria-label="講師マニュアル編集" className={reviewContext?'academy-plan-manual-review':undefined} style={reviewContext?{position:'fixed',top:62,right:0,bottom:0,zIndex:30,overflow:'auto',background:'#f7f6f3'}:{position:'fixed',inset:0,zIndex:100,overflow:'auto',background:'#f7f6f3'}}>{lesson?<LessonNoteEditor backLabel={reviewContext?'← 受講後設定へ戻る':undefined} outlineLabel={reviewContext?'講師マニュアルの章・教材':undefined} savedMessage={reviewContext?'下書きに反映しました。販売プランの最後のSTEPで保存してください。':undefined} courseTitle={reviewContext?'販売プラン ＞ 受講後 ＞ 講師マニュアル':'講師マニュアル（受講者教材とは別に保存）'} title={lesson.title} lessonId={lesson.id} lessons={lessons} blocks={lesson.blocks} onChange={next=>change(writeLessons(lessons.map(x=>x.id===lesson.id?{...x,blocks:next}:x)))} onSave={()=>void save()} onBack={close} onLesson={setSelected} onAddLesson={add} onMoveLesson={(i,d)=>change(writeLessons(moveLesson(lessons,i,d)))} onTitle={title=>change(writeLessons(lessons.map(x=>x.id===lesson.id?{...x,title}:x)))} saving={saving} dirty={dirty} error={error}/>:<div style={{padding:24}}><h2>{reviewContext?"販売プラン ＞ 受講後 ＞ 講師マニュアル":"講師マニュアル"}</h2><button type="button" onClick={add}>マニュアルを追加</button>{' '}<button type="button" onClick={close}>{reviewContext?"← 受講後設定へ戻る":"設定に戻る"}</button></div>}</div>;return createPortal(<>{reviewContext&&<style>{'.academy-plan-manual-review{left:230px}@media(max-width:899px){.academy-plan-manual-review{left:0}}'}</style>}{editor}</>,document.body);
}
