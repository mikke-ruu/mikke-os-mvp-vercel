'use client';

import { AcademyManagementActions } from './AcademyManagementActions';
import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useAcademy2Headquarters} from './HeadquartersBoundary';
import {canAcademy2} from '@/lib/academy2/permissions.mjs';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import {writeAcademy2EventWithLocation, getAcademy2Event, type Academy2EventDetail, type Academy2EventInput, listAcademy2EventPlanChoices, type Academy2EventPlanChoice} from '@/lib/academy2/operations';
import {readEventMaterials,matchesMaterialFulfillment,materialMethodLabels,type MaterialFulfillment,type MaterialMethod} from '@/lib/academy2/material-fulfillment';
import {EventKitDestinationsForEvent} from './EventKitDestination';
import styles from './event-form.module.css';
import {useEventAssignee,EventAssigneeControl} from './EventAssigneeControl';
import type {SalesPlanDraft} from '@/lib/academy2/sales-plan-drafts';
import {getExistingEventReview,type ExistingEventReview} from '@/lib/academy2/existing-event-review';
import {eventCapacityError,preservesExistingUnboundedCapacity} from '@/lib/academy2/event-capacity';

const cx=(...names:string[])=>names.map(name=>styles[name]).filter(Boolean).join(' ');
const localDate=(value:string|null)=>value ? new Date(Date.parse(value)+9*3600000).toISOString().slice(0,16) : '';

/** UI-07 event-create v0.2. Unsupported controls stay visible and unavailable; never silently discarded. */
export function Academy2EventForm({eventId,onBack,onSaved,initialPlanId,embedded=false,onDirtyChange,draftKey,summaryPlan}:{eventId?:string;onBack?:()=>void;onSaved?:(event?:Academy2EventDetail)=>void;initialPlanId?:string;embedded?:boolean;onDirtyChange?:(dirty:boolean)=>void;draftKey?:string;summaryPlan?:SalesPlanDraft}) {
 const hq=useAcademy2Headquarters();
 const search=useSearchParams();
 const assignee=useEventAssignee(hq?.id,eventId);
 const [scheduleContactConfirmed,setScheduleContactConfirmed]=useState(false);
 const [plans,setPlans]=useState<Academy2EventPlanChoice[]>([]);
 const [planId,setPlanId]=useState(initialPlanId??search.get('plan')??'');
 const [courseId,setCourseId]=useState('');
 const [detail,setDetail]=useState<Academy2EventDetail|null>(null);
 const [reviewCandidate,setReviewCandidate]=useState<ExistingEventReview|null>(null),[reviewApplied,setReviewApplied]=useState<ExistingEventReview|null>(null),[reviewError,setReviewError]=useState(''),[reviewLoading,setReviewLoading]=useState(false);
 const [fulfillment,setFulfillment]=useState<MaterialFulfillment>({method:'none',destination:{recipient_name:'',postal_code:'',address:''}});
 const [form,setForm]=useState<Academy2EventInput>({title:'',scheduleMode:'fixed',startsAt:null,endsAt:null,format:'in_person',capacity:1,venueName:'',meetingUrl:'',location:{address:'',address_visibility:'private',area:'',participant_note:''}});
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[dirty,setDirty]=useState(false),[saved,setSaved]=useState(false),[retry,setRetry]=useState(0);
 const inFlight=useRef(false),request=useRef<{id:string;body:string}|null>(null);
 const pendingCreated=useRef<string|null>(null);
 const uncertainCreate=useRef(false);
 const savedNavigation=useRef(false);
 const [dateParts,setDateParts]=useState({day:'',time:''});
 const [draftConflict,setDraftConflict]=useState(false);
 const sourceRevision=useRef<number|null>(null);
 const storageKey=draftKey&&hq?`academy-event:${hq.id}:${draftKey}:${eventId??initialPlanId??'new'}`:null;
 function restoreWorkingInput(revision:number|null){
  sourceRevision.current=revision;if(!storageKey)return;
  try{const raw=sessionStorage.getItem(storageKey);if(!raw)return;const cached=JSON.parse(raw);
   if(!cached?.dirty||cached.planId!==planId||cached.eventId!==(eventId??null)||!cached.form||typeof cached.form.title!=='string'||!['fixed','arranged_after_application'].includes(cached.form.scheduleMode)||!['in_person','online'].includes(cached.form.format)||!cached.fulfillment||!['none','venue_handover','learner_shipping','designated_shipping'].includes(cached.fulfillment.method))return;
   setForm(cached.form);setFulfillment(cached.fulfillment);if(cached.dateParts&&typeof cached.dateParts.day==='string'&&typeof cached.dateParts.time==='string')setDateParts(cached.dateParts);setDirty(true);
   if(cached.request&&typeof cached.request.id==='string'&&typeof cached.request.body==='string')request.current=cached.request;
    if(typeof cached.pendingCreated==='string')pendingCreated.current=cached.pendingCreated;
    uncertainCreate.current=cached.uncertainCreate===true;
   if(cached.sourceRevision!==revision){setDraftConflict(true);setError('保存済みの版が更新されています。入力内容は復元しましたが、このまま保存できません。入力を控えてから最新の内容を読み直してください。');}
  }catch{setError('入力中の開催内容を復元できませんでした。保存済みの開催内容を確認してください。');}
 }
 useEffect(()=>{if(form.startsAt){const value=localDate(form.startsAt);setDateParts({day:value.slice(0,10),time:value.slice(11,16)});}},[form.startsAt]);
 const allowed=!!hq&&canAcademy2(hq.role,'applications.operate',{sameHeadquarters:true});
 useEffect(()=>{if(!hq)return;let active=true;const preserveInput=dirty||assignee.dirty;setLoading(true);setError('');
  const run=async()=>{let loadedRevision:number|null=null;try{if(eventId){let row=await getAcademy2Event(hq.id,eventId);if(row.kit_settings.contract_version===2){const material=await readEventMaterials(hq.id,eventId);if(!material)throw new Error('受け渡し設定を取得できませんでした。');if(!preserveInput)setFulfillment(material??{method:'none',destination:{recipient_name:'',postal_code:'',address:''}});}if(!active)return;
    // Do not turn an older read projection into empty strings and erase existing details.
    if(!Object.hasOwn(row,'location')||!Object.hasOwn(row,'venue_name')||!Object.hasOwn(row,'meeting_url'))throw new Error('開催詳細の保存接続を準備しています。会場・参加URLを保護するため編集を停止しています。');
    loadedRevision=row.revision;setDetail(row);setPlanId(row.sales_plan_id??'');setCourseId(row.course_id);
    if(!preserveInput)setForm({title:row.title,scheduleMode:row.schedule_mode,startsAt:row.starts_at,endsAt:row.ends_at,format:row.format,capacity:row.capacity,venueName:row.venue_name??'',meetingUrl:row.meeting_url??'',kitMethod:row.kit_method,location:row.location??undefined});
   }else{const rows=await listAcademy2EventPlanChoices(hq.id);loadedRevision=rows.find(p=>p.id===planId)?.revision??null;if(active)setPlans(rows.filter(row=>row.configuration.study_style==='instructor'));
    const copyId=search.get('copyEvent');if(copyId&&!preserveInput){const source=await getAcademy2Event(hq.id,copyId);const plan=rows.find(row=>row.id===source.sales_plan_id);
     if(!plan||plan.revision!==source.plan_revision)throw new Error('複製元と販売プランの保存版が一致しません。最新の販売プランから開催を作成してください。');
     if(!Object.hasOwn(source,'venue_name')||!Object.hasOwn(source,'meeting_url'))throw new Error('複製元の会場・参加URLを取得できませんでした。');
     const material=source.kit_settings.contract_version===2?await readEventMaterials(hq.id,copyId):null;
     if(source.kit_settings.contract_version===2&&!material)throw new Error('複製元の受け渡し設定を取得できませんでした。');
     if(active){setPlanId(plan.id);setCourseId('');setForm({title:`${source.title.slice(0,296)}（複製）`,scheduleMode:source.schedule_mode,startsAt:null,endsAt:null,format:source.format,capacity:source.capacity,venueName:source.venue_name??'',meetingUrl:source.meeting_url??'',kitMethod:source.kit_method,location:source.location??undefined});if(material)setFulfillment(material);}
    }
   }
   if(active){if(!preserveInput){setDirty(false);restoreWorkingInput(loadedRevision);}setSaved(false);}
  }catch(cause){if(active)setError(cause instanceof Error?cause.message:'開催を読み込めませんでした。');}finally{if(active)setLoading(false);}};void run();return()=>{active=false;};
 },[hq,eventId,retry]);
 useEffect(()=>{let active=true;setReviewCandidate(null);setReviewError('');if(!hq||!eventId||!detail||!allowed)return;setReviewLoading(true);
  getExistingEventReview(hq.id,eventId).then(candidate=>{if(!active)return;if(candidate&&(candidate.event_revision!==detail.revision||candidate.plan_id!==detail.sales_plan_id||candidate.course_id!==detail.course_id))throw new Error('開催が更新されています。最新の開催内容を読み直してください。');setReviewCandidate(candidate);}).catch(cause=>{if(active)setReviewError(cause instanceof Error?cause.message:'販売プランの見直しを確認できませんでした。');}).finally(()=>{if(active)setReviewLoading(false);});
  return()=>{active=false;};
 },[hq?.id,eventId,detail?.revision,allowed,retry]);
 useEffect(()=>{setReviewApplied(null);},[hq?.id,eventId]);
 useEffect(()=>{if(eventId)return;const plan=plans.find(row=>row.id===planId);if(!plan)return;setForm(current=>({...current,title:current.title||plan.configuration.title,format:plan.configuration.allowed_methods.includes(current.format)?current.format:plan.configuration.allowed_methods[0]??current.format}));},[eventId,plans,planId]);
 useEffect(()=>{if(assignee.dirty)savedNavigation.current=false;},[assignee.dirty]);
 useEffect(()=>{if(!storageKey||loading)return;try{if(dirty)sessionStorage.setItem(storageKey,JSON.stringify({dirty:true,eventId:eventId??null,planId,sourceRevision:sourceRevision.current,form,fulfillment,dateParts,request:request.current,pendingCreated:pendingCreated.current,uncertainCreate:uncertainCreate.current}));else sessionStorage.removeItem(storageKey);}catch{setError('入力中の開催内容をブラウザに保持できません。画面を閉じる前に保存してください。');}},[storageKey,loading,dirty,planId,eventId,form,fulfillment,dateParts,saving]);
 useEffect(()=>{onDirtyChange?.(dirty||assignee.dirty);},[dirty,assignee.dirty,onDirtyChange]);
 useEffect(()=>{if(!dirty&&!assignee.dirty&&!saving)return;const guard=(event:BeforeUnloadEvent)=>{if(savedNavigation.current)return;event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty,assignee.dirty,saving]);
 const leave=()=>!inFlight.current&&(!(dirty||assignee.dirty)||window.confirm('保存していない開催内容または担当者の入力があります。画面を移動しますか？'));
 if(!hq)return null;
 const href=(path:string)=>toAcademyContextHref(path,hq.id,'manage');
 const selected=plans.find(plan=>plan.id===planId);
 const config=selected?.configuration;
 const summaryMismatch=!!summaryPlan&&!loading&&(summaryPlan.id!==planId||summaryPlan.revision!==(eventId?reviewApplied?.review_plan_revision??detail?.plan_revision:selected?.revision));
 // The event represents the plan; the first saved course is only the legacy scheduling anchor.
 const selectedCourseId=courseId||selected?.course_snapshot[0]?.course_id||'';
 const kit=reviewApplied?.configuration.kit??detail?.kit_settings??config?.kit;
 const allowedMethods=reviewApplied?.configuration.allowed_methods??detail?.allowed_methods??config?.allowed_methods??['in_person','online'];
 const materialV2=kit?.contract_version===2;
 const effectiveFulfillment:MaterialFulfillment={...fulfillment,method:!kit?.enabled?'none':form.format==='online'?'learner_shipping':fulfillment.method};
 const kitMethods=(kit?.methods??[]).filter(method=>form.format!=='online'||method==='shipping');
 const kitMethod=!kit?.enabled?null:kitMethods.length===1?kitMethods[0]:kitMethods.find(method=>method===form.kitMethod)??null;
 const kitLabel=materialV2?materialMethodLabels[effectiveFulfillment.method]:kitMethod==='shipping'?'事前に発送':kitMethod==='venue_handover'?'会場で手渡し':kit?.enabled?'選択してください':'キットなし';
 const planTitle=reviewApplied?.configuration.title??detail?.sales_plan_name??config?.title??'販売プランを選択';
 const date=dateParts.day+(dateParts.time?'T'+dateParts.time:''),end=localDate(form.endsAt);
 const change=<K extends keyof Academy2EventInput>(key:K,value:Academy2EventInput[K])=>{savedNavigation.current=false;setForm(current=>({...current,[key]:value}));setDirty(true);setSaved(false);};
 const setDate=(day:string,time:string)=>{setDateParts({day,time});change('startsAt',day&&time?new Date(`${day}T${time}:00+09:00`).toISOString():null);};
 const individualRequested=form.scheduleMode==='arranged_after_application'&&(!eventId||detail?.individual_consultation===true);
 const scheduleChanged=!!detail&&detail.application_count>0&&(form.scheduleMode!==detail.schedule_mode||(form.startsAt?Date.parse(form.startsAt):null)!==(detail.starts_at?Date.parse(detail.starts_at):null)||(form.endsAt?Date.parse(form.endsAt):null)!==(detail.ends_at?Date.parse(detail.ends_at):null));
 useEffect(()=>{setScheduleContactConfirmed(false);},[form.scheduleMode,form.startsAt,form.endsAt]);
 async function applyReviewedPlan(){if(!reviewCandidate||!eventId||reviewLoading||saving)return;setReviewLoading(true);setReviewError('');try{const latest=await getExistingEventReview(hq!.id,eventId);if(!latest||latest.event_revision!==detail?.revision||latest.plan_id!==reviewCandidate.plan_id||latest.review_plan_revision!==reviewCandidate.review_plan_revision)throw new Error('販売プランまたは開催が更新されています。最新の内容を読み直してください。');setReviewApplied(latest);setDirty(true);setSaved(false);request.current=null;savedNavigation.current=false;}catch(cause){setReviewError(cause instanceof Error?cause.message:'販売プランの見直しを反映できませんでした。');}finally{setReviewLoading(false);}}
 async function save(event:React.FormEvent){event.preventDefault();if(inFlight.current||!hq||!allowed)return;savedNavigation.current=false;setError('');
  if(reviewLoading)return setError('販売プランの確認が終わるまでお待ちください。');
  if(reviewApplied&&!allowedMethods.includes(form.format))return setError('見直した販売プランで利用できる開催方法を選択してください。');
  if(summaryMismatch)return setError('販売プランが更新されています。保存済みの内容を読み直してください。');
  if(draftConflict)return setError('保存済みの版が更新されています。入力を控えてから最新の内容を読み直してください。');
  if(scheduleChanged&&!scheduleContactConfirmed)return setError('この日程変更は参加者全員に反映されます。申込者への連絡を確認してください。');
  if(!form.title.trim())return setError('開催名を入力してください。');
  if(form.title.length>300)return setError('開催名は300文字以内で入力してください。');
  const capacityError=eventCapacityError({eventId,existing:detail,scheduleMode:form.scheduleMode,capacity:form.capacity,individualRequested});
  if(capacityError)return setError(capacityError);
  if(form.startsAt&&!Number.isFinite(Date.parse(form.startsAt))||form.endsAt&&!Number.isFinite(Date.parse(form.endsAt)))return setError('開催日時を確認してください。');
  const meetingUrl=form.format==='online'?(form.meetingUrl??'').trim():'';
  if(meetingUrl&&(meetingUrl.length>2048||!/^https:\/\//.test(meetingUrl)||/[\s\u0000-\u001f]/.test(meetingUrl)))return setError('オンライン参加URLは空白を含まない https:// で始まるURLを入力してください。');
  if(form.scheduleMode==='fixed'&&!form.startsAt)return setError('開催日・開始時間を入力してください。');
  if(form.scheduleMode==='fixed'&&form.endsAt&&(!form.startsAt||Date.parse(form.endsAt)<=Date.parse(form.startsAt)))return setError('終了時間は開始時間より後にしてください。');
  if(!eventId&&(!selected||!selectedCourseId))return setError('講座を含む販売プランを選択してください。');
  if(eventId&&(!detail||detail.revision===null))return setError('この開催は互換経路で保持されています。2.0からは変更できません。');
  if(!kit||!Array.isArray(kit.methods))return setError('キット設定を読み込めません。再読み込みしてください。');
  if(kit.enabled&&!materialV2&&!kitMethod)return setError('キットの受け渡し方法を選択してください。');
  if(materialV2&&kit.enabled&&effectiveFulfillment.method==='none')return setError('物品の受け渡し方法を選択してください。');
  if(materialV2&&effectiveFulfillment.method==='designated_shipping'&&(!effectiveFulfillment.destination?.recipient_name.trim()||!effectiveFulfillment.destination?.postal_code.trim()||!effectiveFulfillment.destination?.address.trim()))return setError('指定先の宛名・郵便番号・住所を入力してください。');
  if(materialV2&&effectiveFulfillment.method==='designated_shipping'&&effectiveFulfillment.destination&&[effectiveFulfillment.destination.recipient_name.trim().length>200,effectiveFulfillment.destination.postal_code.trim().length>30,effectiveFulfillment.destination.address.trim().length>2000].some(Boolean))return setError('指定先は宛名200文字・郵便番号30文字・住所2000文字以内で入力してください。');
  const input={...form,meetingUrl,kitMethod,...(individualRequested?{capacity:null}:{}),...(form.scheduleMode==='arranged_after_application'?{startsAt:null,endsAt:null}:{})};
  const courseId=selectedCourseId;
  const body=JSON.stringify({eventId,revision:detail?.revision,planId,courseId,input,fulfillment:materialV2?effectiveFulfillment:null,reviewPlanRevision:reviewApplied?.review_plan_revision});
  if(!eventId&&(pendingCreated.current||uncertainCreate.current)&&request.current?.body!==body)return setError('前回の保存結果を確認できていません。重複作成を防ぐため、前回と同じ入力で保存結果を確認してください。入力内容は残っています。');
  if(request.current?.body!==body)request.current={id:crypto.randomUUID(),body};
  inFlight.current=true;setSaving(true);if(!eventId)uncertainCreate.current=true;
  try{const result=await writeAcademy2EventWithLocation(hq.id,eventId??null,detail?.revision??0,request.current!.id,{...input,...(!eventId?{planId,planRevision:selected!.revision,courseId}:reviewApplied?{legacyReviewPlanRevision:reviewApplied.review_plan_revision}:{})},materialV2||individualRequested?{method:effectiveFulfillment.method,...(effectiveFulfillment.method==='designated_shipping'?{destination:effectiveFulfillment.destination}:{})}:null,individualRequested);
   if(!eventId)pendingCreated.current=result.id;
   if(materialV2){const verified=await readEventMaterials(hq.id,result.id);if(!matchesMaterialFulfillment(verified,effectiveFulfillment))throw new Error('開催は保存されましたが、受け渡し設定の再取得を確認できませんでした。入力内容は残っています。');}
   if(!eventId){const persisted=await getAcademy2Event(hq.id,result.id);pendingCreated.current=null;uncertainCreate.current=false;if(storageKey){try{sessionStorage.removeItem(storageKey);}catch{/* Server save remains authoritative. */}}savedNavigation.current=true;setDirty(false);setSaved(true);if(embedded&&onSaved){onSaved(persisted);return;}window.location.assign(href(`/academy/classes/${result.id}${search.get('plan')?`?returnPlan=${encodeURIComponent(search.get('plan')!)}`:''}`));return;}
   const persisted=await getAcademy2Event(hq.id,result.id);setDetail(persisted);setReviewApplied(null);setForm(current=>({...current,kitMethod:persisted.kit_method}));setDirty(false);request.current=null;await assignee.save();setSaved(true);onSaved?.(persisted);
  }catch(cause){const code=(cause as {code?:string}).code;if(['22023','42501','PT409','PGRST202','42883'].includes(code??''))uncertainCreate.current=false;setError(cause instanceof Error?cause.message:'保存できませんでした。入力内容は残っています。');if(reviewApplied&&code==='PT409')setReviewError('販売プランまたは開催が更新されています。再確認してから見直した内容を反映してください。');}finally{inFlight.current=false;setSaving(false);}
 }
 const location=form.location??{address:'',address_visibility:'private' as const,area:'',participant_note:''};
 const locationLocked=!!detail&&(detail.registration_status==='open'||detail.application_count>0);
 const updateLocation=(patch:Partial<typeof location>)=>change('location',{...location,...patch});
 const unsupported=null;
 return <main className={`${styles.wrap} ${embedded?styles.embedded:''}`}>
  {!embedded&&<>{onBack?<button className={styles.back} disabled={saving} onClick={()=>{if(embedded||leave())onBack();}}>← 開催詳細へ</button>:<Link className={styles.back} href={href(search.get('plan')?`/academy/offerings/${search.get('plan')}?step=6`:'/academy/classes')} onClick={e=>{if(!leave())e.preventDefault();}}>{search.get('plan')?'← 販売プランへ戻る':'← 開催一覧へ'}</Link>}<div className={styles.head}><div className={styles.en}>EVENT</div><div className={styles.jp}>{eventId?'開催の編集':'開催を追加'}</div></div><div className={styles.intro}><p>開催日程や担当者、会場などを設定します。</p></div></>}
  {!embedded&&eventId&&hq&&detail&&<AcademyManagementActions compact hideState key={eventId+":"+detail.revision} headquartersId={hq.id} kind="event" id={eventId} title={form.title} disabled={dirty||saving||assignee.dirty} onChanged={()=>setRetry(n=>n+1)}/>}
  {!eventId&&search.get('copyEvent')?<p className={styles.help}>開催内容を新しい下書きへ複製します。日時を確認して保存してください。申込・入金・発送・出欠・修了・担当者の履歴は引き継ぎません。</p>:null}
  {loading?<p role="status">読み込み中…</p>:<div className={styles.layout}><form className={styles.card} onSubmit={save}>
   <h2>開催内容</h2>{summaryMismatch&&<div role="alert" className={styles.error}>販売プランが更新されています。保存済みの内容を読み直してください。<button type="button" className={styles.btn} onClick={()=>{if(leave())window.location.reload();}}>読み直す</button></div>}
   {reviewCandidate&&<div className={styles.help}><p>{reviewApplied&&reviewApplied.review_plan_revision===reviewCandidate.review_plan_revision?'見直した販売プランを入力画面に反映しました。受け渡し方法を確認し、開催を保存してください。':'販売プランの受講方法・物品の設定が見直されています。開催に反映して、受け渡し方法を確認してください。'}</p>{(!reviewApplied||reviewApplied.review_plan_revision!==reviewCandidate.review_plan_revision)&&<button type="button" className={styles.btn} disabled={reviewLoading||saving} onClick={()=>void applyReviewedPlan()}>見直した販売プランを反映</button>}</div>}
   {reviewError&&<p role="alert" className={styles.error}>{reviewError}<button type="button" className={styles.btn} disabled={saving||reviewLoading} onClick={()=>setRetry(value=>value+1)}>再確認</button></p>}
   <fieldset disabled={!allowed||saving||reviewLoading||summaryMismatch||!!eventId&&!detail}>
    <div className={styles.planbox}><b>販売プラン</b>{eventId?<strong>{planTitle}</strong>:<div className={styles.field}><select aria-label="販売プラン" disabled={embedded} value={planId} onChange={e=>{setPlanId(e.target.value);setCourseId('');change('kitMethod',null);}}><option value="">選択してください</option>{plans.map(plan=><option key={plan.id} value={plan.id}>{plan.configuration.title}</option>)}</select></div>}
     <span>講師から受講</span>{!eventId&&selected?<p className={styles.help}>含まれる講座：{(summaryPlan?summaryPlan.configuration.course_ids.map(id=>summaryPlan.course_snapshot.find(c=>c.course_id===id)?.title).filter(Boolean):selected.course_snapshot.map(c=>c.title)).join('、')}</p>:null}
    </div>
    <div className={styles.field}><label>開催名<input value={form.title} onChange={e=>change('title',e.target.value)} maxLength={300}/></label></div>
    <div className={styles.choices}>{(['fixed','arranged_after_application'] as const).map(mode=><button type="button" disabled={!!eventId&&detail?.schedule_mode!==mode} aria-pressed={form.scheduleMode===mode} key={mode} className={cx('choice',form.scheduleMode===mode?'on':'')} onClick={()=>change('scheduleMode',mode)}><strong>{mode==='fixed'?'日時を決めて募集する':'個別に日程を相談する'}</strong><p>{mode==='fixed'?'開催日・時間・会場などを決めて、その日程で参加者を募集します。':'申込者ごとに日時を決め、受付は継続します。'}</p></button>)}</div>
    <div className={styles.section}><h3>開催方法</h3><div className={styles.methods}>{(['in_person','online'] as const).map(method=><button type="button" key={method} disabled={!allowedMethods.includes(method)} aria-pressed={form.format===method} className={cx('method',form.format===method?'on':'')} onClick={()=>change('format',method)}><strong>{method==='in_person'?'対面':'オンライン'}</strong><p>{method==='in_person'?'会場で開催します。':'Zoomなどで開催します。'}</p></button>)}</div></div>
    {detail?.schedule_mode==='arranged_after_application'&&!detail.individual_consultation&&<p className={styles.help}>この既存募集は参加者共通の日程です。個別の日程相談は新しい募集を作成してください。</p>}<div className={styles.section}>{form.scheduleMode==='fixed'?<h3>日時</h3>:null}<div className={styles.grid2}>
     {form.scheduleMode==='fixed'?<>
     <div className={styles.field}><label>開催日<input type="date" value={date.slice(0,10)} onChange={e=>setDate(e.target.value,date.slice(11)||'09:00')}/></label></div>
     <div className={styles.field}><label>開始時間<input type="time" value={date.slice(11)} onChange={e=>setDate(date.slice(0,10),e.target.value)}/></label></div>
     <div className={styles.field}><label>終了時間<input type="time" value={end.slice(11)} onChange={e=>change('endsAt',e.target.value&&date?new Date(`${date.slice(0,10)}T${e.target.value}:00+09:00`).toISOString():null)}/></label></div>
     </>:null}
     {individualRequested?<div className={styles.field}><strong>1回の受講人数：1名</strong><p className={styles.help}>受付停止するまで継続して募集します。</p></div>:<div className={styles.field}><label>定員<input type="number" min={1} value={form.capacity??''} onChange={e=>change('capacity',e.target.value?Number(e.target.value):null)}/></label>{preservesExistingUnboundedCapacity({eventId,existing:detail,scheduleMode:form.scheduleMode,capacity:form.capacity})&&<p className={styles.help}>定員なし（現在の設定）</p>}</div>}
    </div></div>
    <div className={styles.section}><h3>{form.format==='in_person'?'会場':'オンライン参加'}</h3><div className={styles.field}>{form.format==='in_person'?<label>会場名<input value={form.venueName??''} onChange={e=>change('venueName',e.target.value)}/></label>:<label>参加URL<input type="url" placeholder="https://zoom.us/..." value={form.meetingUrl??''} onChange={e=>change('meetingUrl',e.target.value)}/></label>}</div>
     {unsupported}
    </div>
    {scheduleChanged?<div className={styles.section}><p className={styles.help}>この日程変更は開催全体に反映されます。自動通知は行いません。</p><label><input type="checkbox" checked={scheduleContactConfirmed} onChange={e=>setScheduleContactConfirmed(e.target.checked)}/> 申込者への連絡が完了しました</label></div>:null}
    <EventAssigneeControl state={assignee} locked={!allowed||saving||!!detail?.instructor_name}/>

{materialV2?<>{kit?.enabled?<div className={styles.section}><h3>物品の受け渡し</h3><p className={styles.help}>{kit.name}</p><div className={styles['kit-options']}>{(form.format==='online'?['learner_shipping']:['venue_handover','learner_shipping','designated_shipping']).map(value=>{const method=value as MaterialMethod;return <button type="button" key={method} aria-pressed={effectiveFulfillment.method===method} className={cx('kit-pill',effectiveFulfillment.method===method?'on':'')} onClick={()=>{savedNavigation.current=false;setFulfillment(current=>({...current,method}));setDirty(true);setSaved(false);}}>{materialMethodLabels[method]}</button>;})}</div>{effectiveFulfillment.method==='designated_shipping'?<div className={styles.grid2}>{(['recipient_name','postal_code','address'] as const).map((key,index)=><div className={styles.field} key={key}><label>{['発送先の宛名','郵便番号','発送先住所'][index]}<input value={fulfillment.destination?.[key]??''} maxLength={key==='address'?2000:key==='postal_code'?30:200} onChange={e=>{savedNavigation.current=false;setFulfillment(current=>({...current,destination:{recipient_name:current.destination?.recipient_name??'',postal_code:current.destination?.postal_code??'',address:current.destination?.address??'',[key]:e.target.value}}));setDirty(true);setSaved(false);}}/></label></div>)}</div>:null}<p className={styles.help}>{effectiveFulfillment.method==='learner_shipping'?'配送先住所は申込時に受講者から取得します。':effectiveFulfillment.method==='designated_shipping'?'指定先は本部だけが確認できます。受講者の配送先住所は取得しません。':'受講者の配送先住所は取得しません。'}</p></div>:null}</>:<div className={styles.section}><h3>キットの受け渡し</h3><div className={styles.kit}><strong>{kit?.enabled?kit.name||'キットあり':'キットなし'}</strong>{kit?.enabled?<><p>{kitMethods.length>1?'販売プランで許可された方法から、この開催での受け渡し方法を選んでください。':form.format==='online'?'オンライン開催のキットは事前に発送します。':'販売プランで指定された方法で受け渡します。'}</p><div className={styles['kit-options']}>{kitMethods.map(method=><button key={method} type="button" aria-pressed={kitMethod===method} className={cx('kit-pill',kitMethod===method?'on':'')} onClick={()=>change('kitMethod',method)}>{method==='shipping'?'事前に発送':'会場で手渡し'}</button>)}</div>{!kitMethods.length?<p role="alert">この開催方法で利用できるキットの受け渡し方法がありません。販売プランを確認してください。</p>:null}{kit.recipient==='instructor'?<p>キットの発送先は担当講師です。受講者への受け渡し方法を確認してください。</p>:null}{eventId&&form.format==='in_person'&&kit.recipient==='instructor'?<EventKitDestinationsForEvent headquartersId={hq.id} eventId={eventId}/>:null}</>:null}</div></div>}
    <div className={styles.section}><h3>開催場所と参加者への案内</h3><fieldset disabled={locationLocked}>
     {form.format==='in_person'&&<><div className={styles.field}><label>会場住所<textarea maxLength={2000} value={location.address} onChange={e=>updateLocation({address:e.target.value})}/></label></div><div className={styles.field}><label>住所の公開範囲<select value={location.address_visibility} onChange={e=>updateLocation({address_visibility:e.target.value as typeof location.address_visibility})}><option value="private">非公開（本部のみ）</option><option value="applicants">入金確認後の申込者のみ</option><option value="public">一般公開</option></select></label></div></>}
     <div className={styles.field}><label>開催エリア<input maxLength={200} value={location.area} onChange={e=>updateLocation({area:e.target.value})}/></label><p className={styles.help}>開催エリアは募集ページに表示されます。</p></div>
     <div className={styles.field}><label>参加者への案内<textarea maxLength={4000} value={location.participant_note} onChange={e=>updateLocation({participant_note:e.target.value})}/></label><p className={styles.help}>入金確認後、申込者本人に表示します。</p></div></fieldset>{locationLocked&&<p className={styles.help}>受付中または申込のある開催では、住所と案内の変更を停止しています。</p>}</div>
    <div className={styles.section}><h3>受付状態</h3><div className={styles.field}><select disabled value={detail?.registration_status??'closed'}><option value="draft">下書き</option><option value="closed">受付停止中</option><option value="open">受付中</option></select></div><p className={styles.help}>受付の開始・停止は開催詳細で行います。</p></div>
    <div className={styles.actions}>{onBack?<button type="button" className={styles.btn} disabled={saving} onClick={()=>{if(embedded||leave())onBack();}}>{embedded?'← 販売プランへ':'← 開催詳細へ'}</button>:<Link className={styles.btn} href={href(search.get('plan')?`/academy/offerings/${search.get('plan')}?step=6`:'/academy/classes')} onClick={e=>{if(!leave())e.preventDefault();}}>{search.get('plan')?'← 販売プランへ戻る':'← 開催一覧へ'}</Link>}<div className={styles.saveArea}><button className={cx('btn','primary')} type="submit" disabled={saving||draftConflict||summaryMismatch}>{saving?'保存中…':embedded?'保存して次へ →':'開催を保存'}</button><p role="status" aria-live="polite" className={styles.help}>{saving?'保存中…':error?'保存・読み込みを確認できませんでした。':saved?'✓ 保存しました':dirty||assignee.dirty?'未保存の変更があります':''}</p></div></div>
   </fieldset>
   {error?<div role="alert" className={styles.error}>{error}<button type="button" className={styles.btn} onClick={()=>{if(draftConflict){if(!window.confirm('復元した入力を破棄して保存済みの内容を読み直しますか？'))return;if(storageKey)sessionStorage.removeItem(storageKey);setDirty(false);setDraftConflict(false);}setRetry(value=>value+1);}}>再読み込み</button></div>:null}
  </form>{embedded&&summaryPlan&&summaryMismatch?<aside className={cx('card','summary')}><p>販売プランの最新の保存内容を確認してください。</p></aside>:embedded&&summaryPlan?<aside className={cx("card","summary")}><details open className={styles.overview}><summary>この開催の内容</summary><div className={styles.sumrow}><span>販売プラン</span><span>{summaryPlan?.configuration.title??planTitle}</span></div><div className={styles.sumrow}><span>受講料</span><span>{summaryPlan?.configuration.price===null?"未設定":new Intl.NumberFormat("ja-JP",{style:"currency",currency:"JPY"}).format(summaryPlan?.configuration.price??0)}</span></div><div className={styles.sumrow}><span>含まれる講座</span><span>{summaryPlan?.course_snapshot.map(c=>c.title).join("、")}</span></div></details></aside>:<aside className={cx('card','summary')}><details open className={styles.overview}><summary>販売プラン</summary><div className={styles.sumrow}><span>{planTitle}</span></div><p className={styles.help}>開催を保存してから、詳細画面で募集条件と受付状態を確認できます。</p></details></aside>}</div>}
 </main>;
}
