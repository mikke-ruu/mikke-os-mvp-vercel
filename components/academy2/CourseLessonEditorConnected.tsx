'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {useMaterialLeaveGuard} from '@/components/academy/useMaterialLeaveGuard';
import {LessonNoteEditor} from './LessonNoteEditor';
import {readLessons,writeLessons,moveLesson} from '@/lib/academy/lesson-content';
import {saveCourseEditor,type CourseEditorDocument} from '@/lib/academy2/course-editor';
import {toCurrentAcademyContextHref as href} from '@/lib/academy/access-context';
import styles from './course-material-navigation.module.css';

export function CourseLessonEditorConnected({headquartersId,courseId,lessonId,initial}:{headquartersId:string;courseId:string;lessonId?:string;initial:CourseEditorDocument}){
 const router=useRouter(),pending=useRef(false),request=useRef<{key:string;id:string}|null>(null);
 const [document,setDocument]=useState(initial);
 // The course editor document is the only source of lessons and their materials.
 const [lessons,setLessons]=useState(()=>readLessons(initial.materials.blocks,initial.materials.curriculum));
 const [activeId,setActiveId]=useState<string|null>(()=>lessonId??readLessons(initial.materials.blocks,initial.materials.curriculum)[0]?.id??null);
 const lesson=lessons.find(item=>item.id===activeId);
 const [dirty,setDirty]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 async function save(){
  if(pending.current)return false;pending.current=true;setSaving(true);setError('');const course=document.course;
  try{
   const payload={courseId,expectedUpdatedAt:course.updated_at,materialRevision:document.materials.revision,legacyUpdatedAt:document.materials.legacyUpdatedAt,basic:{name:course.name,subtitle:course.subtitle??'',description:course.description??'',duration_text:course.duration_text??'',main_image_url:course.main_image_url??'',code:course.code},settings:document.settings,blocks:writeLessons(lessons)};
   const key=JSON.stringify(payload);if(!request.current||request.current.key!==key)request.current={key,id:crypto.randomUUID()};
   const next=await saveCourseEditor(headquartersId,{...payload,requestId:request.current.id});
   setDocument(next);setLessons(readLessons(next.materials.blocks,next.materials.curriculum));request.current=null;setDirty(false);return true;
  }catch(cause){setError(cause instanceof Error?cause.message:'教材を保存できませんでした。入力内容は残っています。');return false;}
  finally{pending.current=false;setSaving(false);}
 }
 useMaterialLeaveGuard({dirty,busy:saving||pending.current,save});
 async function navigate(path:string){if(pending.current)return;if(dirty&&!await save())return;router.push(href(path));}
 const back=()=>void navigate('/academy/courses/'+courseId);
 const navigation=<nav className={styles.tabs} aria-label="講座編集項目"><button type="button" aria-pressed={false} disabled={saving} onClick={back}>基本情報</button><button className={styles.active} type="button" aria-pressed={true} disabled={saving}>レッスン・教材</button></nav>;
 const addLesson=()=>{if(pending.current)return;const id=crypto.randomUUID();setLessons(items=>[...items,{id,title:'新しいレッスン',blocks:[]}]);setActiveId(id);setDirty(true);setError('');};
 if(!lesson)return <main className={styles.empty}>{navigation}{lessonId?<p role="alert">このレッスンを確認できませんでした。</p>:<><h2>レッスン・教材</h2><p>レッスンを追加して教材を作成してください。</p><button type="button" disabled={saving} onClick={addLesson}>＋ レッスン追加</button></>}{error&&<p role="alert">{error}</p>}</main>;
 return <LessonNoteEditor key={activeId} navigation={navigation} courseTitle={document.course.name} title={lesson.title} lessonId={lesson.id} lessons={lessons} blocks={lesson.blocks}
  onChange={blocks=>{setLessons(items=>items.map(item=>item.id===activeId?{...item,blocks}:item));setDirty(true);setError('');}}
  onSave={()=>void save()} onBack={back}
  onLesson={id=>{if(id!==activeId)void navigate('/academy/courses/'+courseId+'/lessons/'+encodeURIComponent(id)+'/edit');}}
  onAddLesson={addLesson}
  onMoveLesson={(index,direction)=>{setLessons(items=>moveLesson(items,index,direction));setDirty(true);}}
  onTitle={title=>{setLessons(items=>items.map(item=>item.id===activeId?{...item,title}:item));setDirty(true);}}
  saving={saving} dirty={dirty} error={error}/>;
}
