'use client';

import {getSalesPlanDraft,type SalesPlanDraft} from '@/lib/academy2/sales-plan-drafts';
import {getEventAssignees,type EventAssigneeView} from '@/lib/academy2/event-assignees';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useAcademy2Headquarters} from './HeadquartersBoundary';
import {materialMethodLabels,type MaterialFulfillment} from '@/lib/academy2/material-fulfillment';
import {EventMaterialShipping} from './EventMaterialShipping';
import {EventKitShipping} from './EventKitShipping';
import {EventAssignmentReplacement} from './EventAssignmentReplacement';
import {EventRegistrationControl} from './EventRegistrationControl';
import type {EventKitShippingView} from '@/lib/academy2/event-kit-shipping';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import {commandEventOperations,getEventOperations,type EventOperationsDetail,type EventOperationCommand,type EventParticipant,type EventAttendanceStatus} from '@/lib/academy2/event-operations';
import {applicationScheduleLabel} from '@/lib/academy2/application-schedule';
import {applicationCompleted} from './HeadquartersApplications';
import styles from './event-detail.module.css';

type Draft={status:EventAttendanceStatus|'unconfirmed';note:string};
const attendanceLabels={unconfirmed:'未確認',present:'出席',absent:'欠席',late:'遅刻'};
const paymentMethods:Record<string,string>={bank:'銀行振込',onsite:'当日支払い',card:'カード決済',external:'外部決済'};
const eventStatuses:Record<string,string>={planned:'開催予定',active:'開催中',completed:'開催終了',cancelled:'中止'};
const paymentMethod=(method:string|null)=>(paymentMethods[method??'']??'支払方法未確認');
const paymentStatus=(person:EventParticipant)=>!person.payment?'':person.payment.status==='paid'?'入金済み':person.payment.status==='not_required'?'支払い不要':person.payment.method==='onsite'?'当日支払い':'入金確認待ち';
const when=(value:string|null)=>value?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'日程未定';
const cx=(...names:string[])=>names.map(name=>styles[name]).filter(Boolean).join(' ');

/** UI10. Attendance and event closure remain separate from individual completion/certification. */
export function Academy2EventDetail({eventId,onEdit}:{eventId:string;onEdit?:()=>void}) {
 const hq=useAcademy2Headquarters();
 return hq?<EventDetailBody key={`${hq.id}:${eventId}`} headquartersId={hq.id} eventId={eventId} onEdit={onEdit}/>:null;
}
function EventDetailBody({headquartersId,eventId,onEdit}:{headquartersId:string;eventId:string;onEdit?:()=>void}) {
 const [data,setData]=useState<EventOperationsDetail|null>(null),[drafts,setDrafts]=useState<Record<string,Draft>>({});
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(''),[confirmFinish,setConfirmFinish]=useState(false);
 const [materialShipping,setMaterialShipping]=useState<MaterialFulfillment|null>(null);
 const [kitShipping,setKitShipping]=useState<EventKitShippingView|null>(null),[shippingDirty,setShippingDirty]=useState(false),[shippingBusy,setShippingBusy]=useState(false);
 const [assignmentDirty,setAssignmentDirty]=useState(false),[assignmentBusy,setAssignmentBusy]=useState(false),[shippingVersion,setShippingVersion]=useState(0);
 const [registrationBusy,setRegistrationBusy]=useState(false);
 const [plan,setPlan]=useState<SalesPlanDraft|null>(null),[planError,setPlanError]=useState('');
 const [assignee,setAssignee]=useState<EventAssigneeView|null>(null),[assigneeError,setAssigneeError]=useState('');
 const inFlight=useRef(false),live=useRef(true),readGeneration=useRef(0),request=useRef<{signature:string;id:string}|null>(null);
 const dirty=Object.keys(drafts).length>0;
 const href=(path:string)=>toAcademyContextHref(path,headquartersId,'manage');
 async function refresh(){if(inFlight.current)return;const generation=++readGeneration.current;setLoading(true);setError('');try{const result=await getEventOperations(headquartersId,eventId);if(live.current&&generation===readGeneration.current){setData(result);request.current=null;}}catch(cause){if(live.current&&generation===readGeneration.current)setError(cause instanceof Error?cause.message:'開催を読み込めませんでした。');}finally{if(live.current&&generation===readGeneration.current)setLoading(false);}}
 useEffect(()=>{live.current=true;void refresh();return()=>{live.current=false;readGeneration.current++;};},[headquartersId,eventId]);
 useEffect(()=>{if(dirty||shippingDirty||assignmentDirty||busy||shippingBusy||assignmentBusy||registrationBusy)return;const revalidate=()=>{if(document.visibilityState==='visible')void refresh();};window.addEventListener('focus',revalidate);document.addEventListener('visibilitychange',revalidate);return()=>{window.removeEventListener('focus',revalidate);document.removeEventListener('visibilitychange',revalidate);};},[dirty,shippingDirty,assignmentDirty,busy,shippingBusy,assignmentBusy,registrationBusy]);
 useEffect(()=>{let active=true;setPlan(null);setPlanError('');const id=data?.event.sales_plan_id;if(id&&data?.permissions.finance)void getSalesPlanDraft(headquartersId,id).then(value=>{if(active)setPlan(value);}).catch(()=>{if(active)setPlanError('販売価格・種類を読み込めませんでした。');});return()=>{active=false;};},[headquartersId,data?.event.sales_plan_id,data?.revision,data?.permissions.finance]);
 useEffect(()=>{let active=true;setAssignee(null);setAssigneeError('');void getEventAssignees(headquartersId,eventId).then(value=>{if(active)setAssignee(value);}).catch(()=>{if(active)setAssigneeError('担当区分を読み込めませんでした。');});return()=>{active=false;};},[headquartersId,eventId,data?.revision]);
 useEffect(()=>{if(!(dirty||shippingDirty||assignmentDirty))return;const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty,shippingDirty,assignmentDirty]);
 function leave(){return !busy&&!shippingBusy&&!assignmentBusy&&!registrationBusy&&(!(dirty||shippingDirty||assignmentDirty)||window.confirm('保存していない出欠・発送・担当交代の入力があります。画面を移動しますか？'));}
 async function command(value:EventOperationCommand){if(!data||data.revision===null||inFlight.current||loading)return;
  const signature=JSON.stringify({headquartersId,eventId,revision:data.revision,command:value});
  if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};
  inFlight.current=true;setBusy(true);setError('');setSaved('');
  try{const result=await commandEventOperations(headquartersId,eventId,data.revision,request.current.id,value);if(!live.current)return;
   setData(result);request.current=null;setConfirmFinish(false);
   if(value.action==='record_attendance')setDrafts(current=>{const next={...current};delete next[value.input.participantKey];return next;});
   setSaved(value.action==='record_attendance'?'出欠を保存しました。':'開催を終了しました。個別の修了・認定は申込ごとに確認してください。');
  }catch(cause){if(live.current)setError(cause instanceof Error?cause.message:'保存できませんでした。入力内容は残っています。');}finally{inFlight.current=false;if(live.current)setBusy(false);}
 }
 const event=data?.event,participants=data?.participants??[],canRecord=!!data?.allowedActions.includes('record_attendance');
 const kits=participants.filter(p=>p.application?.headquarters?.shipping.required&&p.application.headquarters.shipping.recipient!=='instructor'),shipped=kits.filter(p=>p.application?.headquarters?.shipping.status==='shipped').length;
 const kitLabel=event?.kit_settings.contract_version===2?(materialShipping?materialMethodLabels[materialShipping.method]:'物品の受け渡しを確認中'):!event?.kit_settings.enabled?'キットなし':event.kit_settings.recipient==='instructor'?kitShipping?.applicable&&kitShipping.roster.length>0&&kitShipping.remainingCount===0?'講師へ発送済み':'担当講師へ発送':event.kit_method==='venue_handover'?'会場で手渡し':event.kit_method==='shipping'?'受講者へ発送':'受け渡し方法未確認';
 const applicationLink=(person:EventParticipant,label:string)=>person.application?<Link href={href(`/academy/applications/${person.application.summary.applicationId}?fromEvent=${encodeURIComponent(eventId)}`)} onClick={e=>{if(!leave())e.preventDefault();}}>{label}</Link>:null;
 const edit=()=>{if(leave())onEdit?.();};
 const jump=(id:string)=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});
 return <main className={styles.wrap}>
  <Link className={styles.back} href={href('/academy/classes')} onClick={e=>{if(!leave())e.preventDefault();}}>← 開催一覧へ</Link>
  <div className={styles.titlebar}><div className={styles.en}>EVENT</div><div className={styles.jp}>開催詳細</div></div>
  {loading?<p role="status" className={styles.help}>読み込み中…</p>:null}
  {error?<div role="alert" className={styles.error}>{error}<div className={styles.actions}><button className={styles.btn} disabled={busy||loading} onClick={()=>void refresh()}>入力を残して最新の状態を読む</button></div></div>:null}
  {saved?<p role="status" className={styles.saved}>{saved}</p>:null}
  {dirty?<div className={styles.actions}><span className={styles.help}>保存していない出欠の入力があります。</span><button className={styles.btn} disabled={busy||loading} onClick={()=>{if(window.confirm('保存していない出欠の入力を取り消しますか？')){setDrafts({});request.current=null;setSaved('');}}}>入力を取り消す</button></div>:null}
  {data&&event?<div className={styles.detailGrid}><div>

   <section className={styles.card} aria-label="販売プラン情報"><div className={styles.planHeading}><div><h2>{event.sales_plan_name??'販売プラン未設定'}</h2><div className={styles.planFacts}>{!event.sales_plan_id?<span>販売プラン未設定</span>:plan&&plan.revision===event.plan_revision?<><span>{plan.configuration.kind}</span><span>{plan.configuration.price===null?'受講料未設定':new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY'}).format(plan.configuration.price)}</span></>:plan?<span>受講料・種類は開催に紐づく保存版を確認してください</span>:!data.permissions.finance?<span>受講料の閲覧権限がありません</span>:!planError?<span role="status">販売条件を読み込み中…</span>:null}<span>{event.kit_settings.enabled?'物品あり':'物品なし'}</span></div>{planError?<p role="alert" className={styles.help}>{planError}</p>:null}</div></div>
    <EventRegistrationControl headquartersId={headquartersId} event={event} participantCount={participants.length} onRelatedNavigate={leave} relatedPlanHref={event.sales_plan_id?href('/academy/offerings/'+encodeURIComponent(event.sales_plan_id)):undefined} enabled={data.permissions.finance&&data.permissions.operate} locked={busy||shippingBusy||assignmentBusy||loading||dirty||shippingDirty||assignmentDirty} onReload={()=>void refresh()} onBusyChange={setRegistrationBusy}/>
   </section>
   <section className={styles.card} aria-label="開催情報"><div className={styles.eventHeading}><div><h1>{event.title}</h1><p className={styles.eventWhen}>{event.individual_consultation?(event.registration_status==='open'?'個別日程相談・受付中':'個別日程相談'):event.schedule_mode==='arranged_after_application'&&!event.starts_at?'日程相談中':when(event.starts_at)}{event.ends_at?' 〜 '+when(event.ends_at):''}</p><span className={styles.badge}>{eventStatuses[event.status]??'状態未確認'}</span></div><div className={styles.actions}><button className={styles.create} disabled={!onEdit||busy||shippingBusy||assignmentBusy||registrationBusy||loading||!data.permissions.operate||!['planned','active'].includes(event.status)} onClick={edit}>開催内容を編集</button>{data.permissions.operate&&event.sales_plan_id?<details className={styles.relatedMenu}><summary aria-label="開催のその他の操作">…</summary><Link className={styles.textLink} href={href('/academy/classes/new?plan='+encodeURIComponent(event.sales_plan_id)+'&copyEvent='+encodeURIComponent(event.id))} onClick={e=>{if(!leave())e.preventDefault();}}>複製する</Link></details>:null}</div></div><div className={styles.rows}>
    <div className={styles.row}><b>開催方法</b><span>{event.format==='online'?'オンライン':'対面'}</span></div>
    {event.location&&<><div className={styles.row}><b>会場住所</b><span>{event.location.address||'未設定'}{event.location.address&&<>（{event.location.address_visibility==='public'?'一般公開':event.location.address_visibility==='applicants'?'入金確認後の申込者のみ':'非公開'}）</>}</span></div>{event.location.area&&<div className={styles.row}><b>開催エリア</b><span>{event.location.area}</span></div>}{event.location.participant_note&&<div className={styles.row}><b>参加者への案内</b><span style={{whiteSpace:'pre-wrap'}}>{event.location.participant_note}</span></div>}</>}
    <div className={styles.row}><b>{event.format==='online'?'参加URL':'会場'}</b><span>{event.format==='online'?(event.meeting_url?<a href={event.meeting_url} target="_blank" rel="noopener noreferrer">{event.meeting_url}</a>:'未設定'):event.venue_name??'未設定'}</span></div>
    <div className={styles.row}><b>担当区分</b><span>{assignee?.assignment?(assignee.assignment.kind==='headquarters'?'本部':'外部講師'):assigneeError?assigneeError:assignee?(event.instructor_name?'講師':'未定'):'確認中…'}</span></div>
    <div className={styles.row}><b>担当者</b><span>{assignee?.assignment?.name??event.instructor_name??'未定'}</span></div>
    <div className={styles.row}><b>参加者／定員</b><span>{event.individual_consultation?participants.length+'名（1回の受講人数：1名）':<>{participants.length}名 / {event.capacity===null?'定員なし':event.capacity+'名'}</>}</span></div>
   </div>
   {data.permissions.finance&&data.permissions.operate&&event.status==='planned'&&!!event.instructor_response_status&&data.revision!==null?<details className={styles.inlineDetails}><summary>担当講師の依頼・交代</summary><EventAssignmentReplacement headquartersId={headquartersId} eventId={eventId} revision={data.revision} disabled={busy||shippingBusy||registrationBusy||loading||dirty||shippingDirty} onDirtyChange={setAssignmentDirty} onBusyChange={setAssignmentBusy} onReload={()=>{void refresh();setShippingVersion(v=>v+1);}}/></details>:null}
   </section>
   <div inert={registrationBusy}>


   <section className={styles.card} id="event-participants" inert={assignmentBusy}><h2>参加者 <span className={styles.count}>{participants.length}名</span></h2>{!participants.length?<p className={styles.help}>この開催への申込はまだありません。</p>:<div className={styles.personList}>{participants.map(person=>{const draft=drafts[person.key]??{status:person.attendance,note:person.attendanceNote};return <div className={styles.person} key={person.key}>
    <div className={styles.avatar} aria-hidden="true">{Array.from(person.name)[0]??'受'}</div><div>{applicationLink(person,person.name)??<strong>{person.name}</strong>}{event.individual_consultation&&<p className={styles.help}>{applicationScheduleLabel(person.application?.summary.schedule)}</p>}<div className={styles.personMeta}>{person.payment?<span>{paymentMethod(person.payment.method)}</span>:null}{person.application?.headquarters?.shipping.required||(!person.application?.legacy&&event.kit_settings.enabled)?<span>{person.application?.headquarters?.shipping.required?(person.application.headquarters.shipping.status==='shipped'?'発送済み':'発送待ち'):kitLabel}</span>:null}{person.learnerPageAvailable===true?<span>受講者ページ利用可</span>:null}{applicationLink(person,'申込を確認')}</div></div>
    {person.payment?<span className={cx('badge',person.payment.status==='paid'?'green':'orange')}>{paymentStatus(person)}</span>:null}
    <details className={styles.attendance}><summary>出欠：{attendanceLabels[person.attendance]}{person.application&&(applicationCompleted(person.application.summary)||person.application.legacy?.completed===true)?' / 修了済み':''}</summary>{canRecord?<><label>出欠を選択<select aria-label={`${person.name}の出欠`} disabled={busy||loading} value={draft.status} onChange={e=>{setDrafts(current=>({...current,[person.key]:{...draft,status:e.target.value as Draft['status']}}));setSaved('');}}>{Object.entries(attendanceLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>メモ<textarea aria-label={`${person.name}の出欠メモ`} maxLength={2000} disabled={busy||loading} value={draft.note} onChange={e=>{setDrafts(current=>({...current,[person.key]:{...draft,note:e.target.value}}));setSaved('');}}/></label><button className={styles.btn} disabled={busy||loading||!drafts[person.key]||draft.status==='unconfirmed'} onClick={()=>{if(draft.status!=='unconfirmed')void command({action:'record_attendance',input:{participantKey:person.key,status:draft.status,note:draft.note}});}}>出欠を保存</button></>:person.attendanceNote?<span>{person.attendanceNote}</span>:null}</details>
   </div>;})}</div>}</section>
   </div>

   <div inert={registrationBusy}>
   <details className={styles.card} id="event-kit" hidden={!event.kit_settings.enabled&&kits.length===0} inert={assignmentBusy}><summary>材料・教材の受け渡し：{kitLabel}</summary>{event.kit_settings.contract_version!==2?<div className={cx('notice','green')}><b>{kitLabel}</b><br/>{!event.kit_settings.enabled?'この開催にキットはありません。':event.kit_settings.recipient==='instructor'?(event.format==='in_person'?'発送先と発送記録を下で確認できます。':'この開催方法では担当講師への発送を記録できません。'):kits.length?`${kits.length}名分の個別発送記録があり、${shipped}名分が発送済みです。`:'個別の発送記録はありません。'}</div>:null}
    {event.kit_settings.contract_version===2?<EventMaterialShipping canShip={data.permissions.operate} onChange={setMaterialShipping} key={shippingVersion} headquartersId={headquartersId} eventId={eventId} onSaved={()=>void refresh()} onDirtyChange={setShippingDirty} onBusyChange={setShippingBusy}/>:null}
    {event.kit_settings.contract_version!==2&&event.kit_settings.enabled&&event.kit_settings.recipient==='instructor'&&event.format==='in_person'?<EventKitShipping key={shippingVersion} headquartersId={headquartersId} eventId={eventId} onChange={setKitShipping} onSaved={()=>void refresh()} onDirtyChange={setShippingDirty} onBusyChange={setShippingBusy}/>:null}
    {kits.map(person=><div className={styles.paymentRow} key={person.key}>{person.name}：{person.application!.headquarters!.shipping.status==='shipped'?'発送済み':'発送準備中'}{person.application!.headquarters!.shipping.trackingNumber?` / 追跡番号 ${person.application!.headquarters!.shipping.trackingNumber}`:''}　{applicationLink(person,'発送内容を見る')}</div>)}
   </details>
   <details className={styles.card} id="event-after"><summary>開催後の処理</summary><div className={styles.help}>出欠を保存して開催を終了します。修了・証書・認定は販売プランの設定と受講状況を確認し、申込ごとに進めます。</div><div className={styles.actions}><button className={styles.btn} onClick={()=>jump('event-participants')}>出欠を記録</button><button className={cx('btn','primary')} disabled={busy||shippingBusy||assignmentBusy||loading||dirty||shippingDirty||assignmentDirty||!data.allowedActions.includes('finish_event')} onClick={()=>setConfirmFinish(true)}>開催を終了する →</button></div>{dirty?<p className={styles.help}>入力中の出欠を保存してから終了してください。</p>:data.unconfirmedCount>0?<p className={styles.help}>出欠が未確認の参加者が{data.unconfirmedCount}名います。</p>:null}
    {confirmFinish?<div className={styles.section}><p className={styles.help}>開催を終了し、受付を閉じます。終了後は出欠を変更できません。個別の支払い・修了・認定は変更しません。</p><div className={styles.actions}><button className={cx('btn','primary')} disabled={busy||shippingBusy||assignmentBusy||loading||dirty||shippingDirty||assignmentDirty} onClick={()=>void command({action:'finish_event'})}>確認して開催を終了する</button><button className={styles.btn} disabled={busy} onClick={()=>setConfirmFinish(false)}>戻る</button></div></div>:null}
   </details>
  </div></div></div>:null}
 </main>;
}
