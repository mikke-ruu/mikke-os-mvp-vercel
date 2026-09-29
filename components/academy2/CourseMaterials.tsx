"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {AcademyCourseWorkspace} from '@/components/academy/AcademyCourseWorkspace';
import {AcademyLessonEditor} from '@/components/academy/AcademyLessonEditor';
import {AcademyLessonActions} from '@/components/academy/AcademyLessonActions';
import {readLessons,writeLessons} from '@/lib/academy/lesson-content';
import {toCurrentAcademyContextHref} from '@/lib/academy/access-context';
import {getAcademy2CourseMaterials,saveAcademy2CourseMaterials,type Academy2CourseMaterials} from '@/lib/academy2/course-materials';
import type {AcademyPageBlock} from '@/types/database';
export function CourseMaterials({headquartersId,courseId}:{headquartersId:string;courseId:string}){
 const [data,setData]=useState<Academy2CourseMaterials|null>(null);const [blocks,setBlocks]=useState<AcademyPageBlock[]>([]);const [loadError,setLoadError]=useState('');const [error,setError]=useState('');const [saved,setSaved]=useState(false);const [saving,setSaving]=useState(false);const pending=useRef(false);
 useEffect(()=>{let live=true;getAcademy2CourseMaterials(headquartersId,courseId).then(value=>{if(!live)return;setData(value);setBlocks(value.blocks.length?value.blocks:writeLessons(readLessons([],value.curriculum)));setSaved(value.source!=='empty' && (value.blocks.length>0 || value.curriculum.length===0));}).catch(cause=>{if(live)setLoadError(cause instanceof Error?cause.message:'教材を読み込めませんでした。');});return()=>{live=false;};},[headquartersId,courseId]);
 useEffect(()=>{if(!data||saved)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[data,saved]);
 async function save(){if(!data||pending.current)return;pending.current=true;setSaving(true);setError('');try{const result=await saveAcademy2CourseMaterials(data,blocks);setData(result);setSaved(true);}catch(cause){setSaved(false);setError(cause instanceof Error?cause.message:'保存を確認できませんでした。');}finally{pending.current=false;setSaving(false);}}
 if(loadError)return <p role="alert">{loadError}</p>;if(!data)return <p role="status">読み込み中…</p>;
 return <AcademyCourseWorkspace course={{id:courseId}} activeTab="learner" showLegacyTools={false}><div className="space-y-4"><fieldset disabled={saving} className="min-w-0"><AcademyLessonEditor blocks={blocks} curriculum={[]} onChange={next=>{setBlocks(next);setSaved(false);setError('');}} /></fieldset><div className="flex justify-end"><Link className="inline-flex min-h-11 items-center rounded-lg border border-[var(--mikke-line)] bg-white px-4 text-sm font-bold" href={toCurrentAcademyContextHref('/academy/courses/'+courseId)}>講座情報に戻る</Link></div><p className="text-xs text-[var(--mikke-muted)]">教材を下書きとして保存します。現在公開中の教材は変更しません。</p><AcademyLessonActions blocks={blocks} saving={saving} saved={saved} error={error} onSave={save}/></div></AcademyCourseWorkspace>;
}
