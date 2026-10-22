"use client";
import {useEffect,useRef,useState} from 'react';
import {getCourseEditor,type CourseEditorDocument} from '@/lib/academy2/course-editor';
import {loadCommonCourse} from '@/lib/academy2/common-creation';
import type {CommonCourseState} from '@/lib/academy2/common-creation';
import type {Academy2Course} from '@/lib/academy2/courses';
import {readLessons} from '@/lib/academy/lesson-content';
import styles from './SalesPlanDraftEditor.module.css';

/** Read-only confirmation; the sales plan stays mounted and is never saved by opening this dialog. */
export function SalesPlanCourseConfirmation({headquartersId,courseId,course,onClose,returnHref,editInSameTab=false,backLabel='販売プランSTEP1へ戻る'}:{headquartersId:string;courseId:string;course?:Academy2Course;onClose:()=>void;returnHref?:string;editInSameTab?:boolean;backLabel?:string}) {
 const dialog=useRef<HTMLDialogElement>(null);
 const [document,setDocument]=useState<CourseEditorDocument|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 const [details,setDetails]=useState<CommonCourseState|null>(null);
 useEffect(()=>{dialog.current?.showModal();return()=>{if(dialog.current?.open)dialog.current.close();};},[]);
 useEffect(()=>{let live=true;setLoading(true);setError('');loadCommonCourse(headquartersId,courseId).then(state=>{const value=state.document;if(value?.course?.id!==courseId||value.course.headquarters_id!==headquartersId)throw new Error('講座内容を確認できませんでした。');if(live){setDocument(value);setDetails(state);}}).catch(()=>{if(live)setError('講座内容を取得できませんでした。');}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[headquartersId,courseId,retry]);
 const shown=document?.course??course;
 const lessons=document?readLessons(document.materials.blocks,document.materials.curriculum):[];
 const audience=document?.settings.targetAudience??course?.target_audience;
 return <dialog ref={dialog} className={styles.courseConfirmation} aria-label="講座内容の確認" onCancel={event=>{event.preventDefault();onClose();}}>
  <h2>{shown?.name??'講座内容の確認'}</h2>
  {shown?.subtitle&&<p>{shown.subtitle}</p>}{shown?.description&&<><h3>学べる内容</h3><p style={{whiteSpace:'pre-wrap'}}>{shown.description}</p></>}
  {audience&&<><h3>こんな方におすすめ</h3><p>{audience}</p></>}
  {shown?.duration_text&&<p>学習時間の目安：{shown.duration_text}</p>}
  {details&&<><p>参考価格：{details.reference?.reference_price==null?'未設定':`¥${details.reference.reference_price.toLocaleString('ja-JP')}`}</p><h3>受講者へ渡すもの</h3><p style={{whiteSpace:'pre-wrap'}}>{details.shipping?.configuration?details.shipping.configuration.enabled?[details.shipping.configuration.name,details.shipping.configuration.contents].filter(Boolean).join('\n'):'なし':'未設定'}</p></>}
  {loading&&<p role="status">レッスン一覧を確認中…</p>}
  {document&&<><h3>レッスン・教材</h3>{lessons.length?<ol>{lessons.map(lesson=><li key={lesson.id}>{lesson.title}（{lesson.blocks.length}教材）</li>)}</ol>:<p>レッスンはまだ登録されていません。</p>}</>}
  {error&&<div role="alert"><p>{error}</p><button type="button" onClick={()=>setRetry(x=>x+1)}>もう一度確認する</button></div>}
  {returnHref&&<a href={returnHref} target={editInSameTab?undefined:"_blank"} rel={editInSameTab?undefined:"noopener"}>講座情報を編集する</a>}<button type="button" onClick={onClose}>{backLabel}</button>
 </dialog>;
}
