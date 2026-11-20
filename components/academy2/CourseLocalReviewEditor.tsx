'use client';
import {useCallback,useRef,useState,type MouseEvent,type ReactNode} from 'react';
import earringsPhoto from '@/app/academy/publication-review/earrings-hero.png';
import {CourseEditor} from './CourseEditor';
import {HomepageLocalImagePicker} from './HomepageLocalImagePicker';
import {courseSampleDraft} from '@/lib/academy2/course-samples';
import {readLessons} from '@/lib/academy/lesson-content';
import type {CourseEditorDocument,CourseEditorSave} from '@/lib/academy2/course-editor';
const courseId='44444444-4444-4444-8444-444444444444';
function seed():CourseEditorDocument{
 const template=courseSampleDraft('experience'),now=new Date().toISOString();
 return {course:{id:courseId,headquarters_id:'11111111-1111-4111-8111-111111111111',user_id:'local-review',code:'LOCAL-COURSE-01',name:'天然石と淡水パールで作る はじめての耳飾り',subtitle:'自分らしい耳飾りを作る、キット付きオンライン講座',description:'天然石と淡水パールを使い、素材の選び方から組み立て、お手入れまで学びます。キットをご自宅にお届けする想定です。',duration_text:'約120分',main_image_url:earringsPhoto.src,created_at:now,updated_at:now,reference_price:null,reference_revision:0,lesson_count:readLessons(template.blocks).length,material_count:0},settings:template.settings,materials:{courseId,headquartersId:'11111111-1111-4111-8111-111111111111',revision:1,blocks:template.blocks,curriculum:[],source:'academy2_draft',legacyUpdatedAt:null,deliveryChanged:false}};
}
/** The actual CourseEditor, with isolated in-memory persistence and no tenant service calls. */
export function CourseLocalReviewEditor({fresh=false,onContinue,initialDocument,onSaved,onEditorStateChange,relatedPlans}:{fresh?:boolean;onContinue:(document:CourseEditorDocument)=>void;initialDocument?:CourseEditorDocument|null;onSaved?:(document:CourseEditorDocument)=>void;onEditorStateChange?:(state:{dirty:boolean;busy:boolean;saved:boolean})=>void;relatedPlans?:ReactNode}){
 const [initial]=useState(()=>initialDocument?structuredClone(initialDocument):fresh?{...seed(),course:{...seed().course,name:'',subtitle:'',description:'',duration_text:'',main_image_url:''},materials:{...seed().materials,blocks:[],curriculum:[]}}:seed()),saved=useRef(structuredClone(initial)),[state,setState]=useState({dirty:false,busy:false,saved:false}),[verified,setVerified]=useState(Boolean(initialDocument)),[notice,setNotice]=useState('');
 const everSaved=useRef(Boolean(initialDocument)),notify=useRef(onSaved),notifiedStamp=useRef<string|null>(initialDocument?.course.updated_at??null);notify.current=onSaved;
 function notifySaved(document:CourseEditorDocument){if(notifiedStamp.current===document.course.updated_at)return;notifiedStamp.current=document.course.updated_at;notify.current?.(structuredClone(document));}
 const requests=useRef(new Map<string,{input:string;document:CourseEditorDocument}>());
 const onStateChange=useCallback((next:{dirty:boolean;busy:boolean;saved:boolean})=>{setState(next);onEditorStateChange?.(next);if(next.dirty)setVerified(false);if(next.saved&&!next.dirty&&!next.busy){everSaved.current=true;setVerified(true);notifySaved(saved.current);}},[onEditorStateChange]);
 async function reload(id:string){if(id!==saved.current.course.id)throw Error('この確認画面の講座ではありません。');return structuredClone(saved.current);}
 async function save(input:CourseEditorSave){
  const fingerprint=JSON.stringify(input),previous=requests.current.get(input.requestId);if(previous){if(previous.input!==fingerprint)throw Error('保存する内容が変わっています。');return structuredClone(previous.document);}
  if(input.courseId!==null&&(input.courseId!==saved.current.course.id||input.expectedUpdatedAt!==saved.current.course.updated_at)||input.courseId!==null&&input.materialRevision!==saved.current.materials.revision)throw Error('保存済みの内容が変わっています。読み直してください。');
  if(!input.basic.name.trim())throw Error('講座名を入力してください。');
  const lessons=readLessons(input.blocks),stamp=new Date(Math.max(Date.now(),Date.parse(saved.current.course.updated_at)+1)).toISOString();
  saved.current={course:{...saved.current.course,code:input.basic.code??saved.current.course.code,name:input.basic.name,subtitle:input.basic.subtitle,description:input.basic.description,duration_text:input.basic.duration_text,main_image_url:input.basic.main_image_url,updated_at:stamp,lesson_count:lessons.length,material_count:lessons.reduce((sum,lesson)=>sum+lesson.blocks.length,0)},settings:structuredClone(input.settings),materials:{...saved.current.materials,revision:saved.current.materials.revision+1,blocks:structuredClone(input.blocks)}};
  const reloaded=await reload(saved.current.course.id);if(reloaded.course.name!==input.basic.name||reloaded.course.description!==input.basic.description||JSON.stringify(reloaded.settings)!==JSON.stringify(input.settings)||JSON.stringify(reloaded.materials.blocks)!==JSON.stringify(input.blocks))throw Error('保存と再取得の一致を確認できませんでした。');
  requests.current.set(input.requestId,{input:fingerprint,document:structuredClone(reloaded)});setVerified(true);setNotice('この画面のメモリに保存し、同じ内容を読み直しました。');notifySaved(reloaded);return reloaded;
 }
 const canContinue=verified&&!state.dirty&&!state.busy;
 const continueToPlan=()=>{if(canContinue)onContinue(structuredClone(saved.current));};
 function navigateAfterDiscard(destination:string){if(destination.includes('tab=plan')){if(everSaved.current&&!state.busy){onContinue(structuredClone(saved.current));}else setNotice('まだ保存していません。販売プランへ進む前に講座を保存してください。');}else setNotice('講座一覧への移動はこの確認画面には接続していません。保存済みの内容は保持しています。');}
 function localNavigation(event:MouseEvent<HTMLElement>){const anchor=event.target instanceof Element?event.target.closest('a'):null;if(!anchor)return;event.preventDefault();if(anchor.getAttribute('href')?.includes('tab=plan')){if(canContinue)continueToPlan();else setNotice('変更を保存してから販売プランへ進んでください。');}else setNotice('講座一覧への移動はこの確認画面には接続していません。');}
 return <section data-local-course-editor onClickCapture={localNavigation}><CourseEditor relatedPlans={relatedPlans} initial={fresh&&!initialDocument?null:initial} onSave={save} onReload={reload} ImagePicker={HomepageLocalImagePicker} onStateChange={onStateChange} onNavigate={navigateAfterDiscard} onOpenMaterials={()=>setNotice('教材の別画面は今回の確認には接続していません。基本情報はこの画面内に保存しました。')}/><div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',padding:16}}><p role="status">{notice}</p><button type="button" disabled={!canContinue} onClick={continueToPlan} style={{minHeight:44,padding:'10px 18px',borderRadius:9,border:'1px solid var(--mikke-orange,#f75a3b)',background:'var(--mikke-orange,#f75a3b)',color:'#fff',opacity:canContinue?1:.5}}>保存した講座で販売プランへ</button></div></section>;
}
