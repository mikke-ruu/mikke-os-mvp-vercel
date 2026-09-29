"use client";
import { useEffect, useState } from 'react';
import { useRouter,useParams,useSearchParams } from 'next/navigation';
import {CourseLessonEditorConnected} from './CourseLessonEditorConnected';
import { CourseEditor } from './CourseEditor';
import { getCourseEditor, saveCourseEditor, type CourseEditorDocument } from '@/lib/academy2/course-editor';
import { toCurrentAcademyContextHref } from '@/lib/academy/access-context';
export function CourseEditorConnected({ headquartersId, courseId, sampleId }: { headquartersId:string; courseId?:string; sampleId?:string|null }) {
 const params=useParams<{lessonId?:string}>();const query=useSearchParams();const materialMode=Boolean(params.lessonId)||query.get('tab')==='lessons';const loadKey=courseId+':'+materialMode+':'+(params.lessonId??'');const [loadedKey,setLoadedKey]=useState('');const router=useRouter();const [initial,setInitial]=useState<CourseEditorDocument|null>(null);const [loading,setLoading]=useState(Boolean(courseId));const [error,setError]=useState('');const [retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;if(!courseId)return;setLoading(true);setError('');getCourseEditor(headquartersId,courseId).then(value=>{if(live){setInitial(value);setLoadedKey(loadKey);}}).catch(cause=>{if(live)setError(cause instanceof Error?cause.message:'講座を読み込めませんでした。');}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[headquartersId,courseId,retry,loadKey]);
 if(loading||(courseId&&loadedKey!==loadKey&&!error))return <p role="status">講座を読み込んでいます…</p>;
 if(error)return <div role="alert"><p>{error}</p><button type="button" onClick={()=>setRetry(n=>n+1)}>もう一度読み込む</button></div>;
 if(courseId&&materialMode)return <CourseLessonEditorConnected key={loadKey+":"+initial!.materials.revision} headquartersId={headquartersId} courseId={courseId} lessonId={params.lessonId} initial={initial!}/>;
 return <CourseEditor headquartersId={headquartersId} key={`${headquartersId}:${courseId??sampleId??'new'}:${retry}`} initial={initial} sampleId={sampleId} onSave={input=>saveCourseEditor(headquartersId,input)} onReload={id=>getCourseEditor(headquartersId,id)} onCreated={id=>router.replace(toCurrentAcademyContextHref('/academy/courses/'+id+'?created=1'))}/>;
}
