'use client';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useAcademy2Headquarters} from './HeadquartersBoundary';
import {EventKitShipping} from './EventKitShipping';
import {EventAssignmentReplacement} from './EventAssignmentReplacement';
import type {EventKitShippingView} from '@/lib/academy2/event-kit-shipping';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import {commandEventOperations,getEventOperations,type EventOperationsDetail,type EventOperationCommand,type EventParticipant,type EventAttendanceStatus} from '@/lib/academy2/event-operations';
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
 const [kitShipping,setKitShipping]=useState<EventKitShippingView|null>(null),[shippingDirty,setShippingDirty]=useState(false),[shippingBusy,setShippingBusy]=useState(false);
 const [assignmentDirty,setAssignmentDirty]=useState(false),[assignmentBusy,setAssignmentBusy]=useState(false),[shippingVersion,setShippingVersion]=useState(0);
 const inFlight=useRef(false),live=useRef(true),readGeneration=useRef(0),request=useRef<{signature:string;id:string}|null>(null);
 const dirty=Object.keys(drafts).length>0;
 const href=(path:string)=>toAcademyContextHref(path,headquartersId,'manage');
 async function refresh(){if(inFlight.current)return;const generation=++readGeneration.current;setLoading(true);setError('');try{const result=await getEventOperations(headquartersId,eventId);if(live.current&&generation===readGeneration.current){setData(result);request.current=null;}}catch(cause){if(live.current&&generation===readGeneration.current)setError(cause instanceof Error?cause.message:'開催を読み込めませんでした。');}finally{if(live.current&&generation===readGeneration.current)setLoading(false);}}
 useEffect(()=>{live.current=true;void refresh();return()=>{live.current=false;readGeneration.current++;};},[headquartersId,eventId]);
 useEffect(()=>{if(!dirty)return;const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty]);
 function leave(){return !busy&&!shippingBusy&&!assignmentBusy&&(!(dirty||shippingDirty||assignmentDirty)||window.confirm('保存していない出欠・発送・担当交代の入力があります。画面を移動しますか？'));}
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
 const paid=participants.filter(p=>p.payment?.status==='paid').length,onsite=participants.filter(p=>p.payment?.method==='onsite'&&p.payment.status!=='paid');
 const pending=participants.filter(p=>p.payment&& !['paid','not_required'].includes(p.payment.status));
 const kits=participants.filter(p=>p.application?.headquarters?.shipping.required&&p.application.headquarters.shipping.recipient!=='instructor'),shipped=kits.filter(p=>p.application?.headquarters?.shipping.status==='shipped').length;
 const kitLabel=!event?.kit_settings.enabled?'キットなし':event.kit_settings.recipient==='instructor'?kitShipping?.applicable&&kitShipping.roster.length>0&&kitShipping.remainingCount===0?'講師へ発送済み':'担当講師へ発送':event.kit_method==='venue_handover'?'会場で手渡し':event.kit_method==='shipping'?'受講者へ発送':'受け渡し方法未確認';
 const applicationLink=(person:EventParticipant,label:string)=>person.application?<Link href={href(`/academy/applications/${person.application.summary.applicationId}`)} onClick={e=>{if(!leave())e.preventDefault();}}>{label}</Link>:null;
 const edit=()=>{if(leave())onEdit?.();};
 const jump=(id:string)=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});
 return <main className={styles.wrap}>
  <Link className={styles.back} href={href('/academy/classes')} onClick={e=>{if(!leave())e.preventDefault();}}>← 開催一覧へ</Link>
  <div className={styles.titlebar}><div className={styles.en}>EVENT</div><div className={styles.jp}>開催詳細</div></div>
  <div className={styles.headbox}><p>開催当日の参加者・支払い・キット・担当者・開催後の処理をまとめて確認します。</p><button className={styles.create} disabled={!onEdit||busy||shippingBusy||assignmentBusy||loading||!data?.permissions.operate||!event||!['planned','active'].includes(event.status)} onClick={edit}>開催内容を編集</button></div>
  <div className={styles.guide}><b>販売プラン</b><span>→</span><b>開催</b><span>→</span><b>参加者</b><span>→</span><b>受講・修了</b></div>
  {loading?<p role="status" className={styles.help}>読み込み中…</p>:null}
  {error?<div role="alert" className={styles.error}>{error}<div className={styles.actions}><button className={styles.btn} disabled={busy||loading} onClick={()=>void refresh()}>入力を残して最新の状態を読む</button></div></div>:null}
  {saved?<p role="status" className={styles.saved}>{saved}</p>:null}
  {dirty?<div className={styles.actions}><span className={styles.help}>保存していない出欠の入力があります。</span><button className={styles.btn} disabled={busy||loading} onClick={()=>{if(window.confirm('保存していない出欠の入力を取り消しますか？')){setDrafts({});request.current=null;setSaved('');}}}>入力を取り消す</button></div>:null}
  {data&&event?<div className={styles.detailGrid}><div>
   <section className={styles.card}><h2>{event.title}</h2><div className={styles.help}>{when(event.starts_at)}{event.ends_at?` 〜 ${when(event.ends_at)}`:''} / {event.format==='online'?'オンライン':'対面'}</div>
    <div className={styles.statusbar}><span className={cx('badge',event.status==='cancelled'?'orange':'green')}>{eventStatuses[event.status]??'状態未確認'}</span><span className={cx('badge','gray')}>参加者 {participants.length} / {event.capacity??'定員なし'}{event.capacity!==null?'名':''}</span><span className={cx('badge','blue')}>担当：{event.instructor_name??'未設定'}</span></div>
    <div className={styles.summary}><div className={styles.sum}><b>会場</b><strong>{event.format==='online'?'オンライン':event.venue_name??'未設定'}</strong></div><div className={styles.sum}><b>支払い</b><strong>{data.permissions.finance?`${paid}名確認済み / ${onsite.length}名当日`:'閲覧権限がありません'}</strong></div><div className={styles.sum}><b>キット</b><strong>{kitLabel}</strong></div></div>
    <div className={styles.section}><h3>開催情報</h3><div className={styles.rows}>{[['販売プラン',event.sales_plan_name??'未設定'],['受付方法',event.schedule_mode==='fixed'?'日時指定':'申込後に日程相談'],['開催方法',event.format==='online'?'オンライン':'対面'],['日時',when(event.starts_at)],['会場',event.venue_name??'未設定'],['担当講師',event.instructor_name??'未設定']].map(([label,value])=><div className={styles.row} key={label}><b>{label}</b><span>{value}</span></div>)}</div></div>
   </section>
   {data.permissions.finance&&data.permissions.operate&&event.status==='planned'&&data.revision!==null?<section className={styles.card}><h3>担当講師の交代</h3><EventAssignmentReplacement headquartersId={headquartersId} eventId={eventId} revision={data.revision} disabled={busy||shippingBusy||loading||dirty||shippingDirty} onDirtyChange={setAssignmentDirty} onBusyChange={setAssignmentBusy} onReload={()=>{void refresh();setShippingVersion(v=>v+1);}}/></section>:null}
   <section className={styles.card} id="event-participants" inert={assignmentBusy}><h3>参加者</h3>{!participants.length?<p className={styles.help}>この開催への申込はまだありません。</p>:<div className={styles.personList}>{participants.map(person=>{const draft=drafts[person.key]??{status:person.attendance,note:person.attendanceNote};return <div className={styles.person} key={person.key}>
    <div className={styles.avatar} aria-hidden="true">{Array.from(person.name)[0]??'受'}</div><div><strong>{person.name}</strong><div className={styles.personMeta}>{person.payment?<span>{paymentMethod(person.payment.method)}</span>:null}<span>キット：{kitLabel}</span>{person.learnerPageAvailable===true?<span>受講者ページ利用可</span>:null}{applicationLink(person,'申込を確認')}</div></div>
    {person.payment?<span className={cx('badge',person.payment.status==='paid'?'green':'orange')}>{paymentStatus(person)}</span>:null}
    <div className={styles.attendance}><span>出欠：{attendanceLabels[person.attendance]}</span>{canRecord?<><label>出欠を選択<select aria-label={`${person.name}の出欠`} disabled={busy||loading} value={draft.status} onChange={e=>{setDrafts(current=>({...current,[person.key]:{...draft,status:e.target.value as Draft['status']}}));setSaved('');}}>{Object.entries(attendanceLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>メモ<textarea aria-label={`${person.name}の出欠メモ`} maxLength={2000} disabled={busy||loading} value={draft.note} onChange={e=>{setDrafts(current=>({...current,[person.key]:{...draft,note:e.target.value}}));setSaved('');}}/></label><button className={styles.btn} disabled={busy||loading||!drafts[person.key]||draft.status==='unconfirmed'} onClick={()=>{if(draft.status!=='unconfirmed')void command({action:'record_attendance',input:{participantKey:person.key,status:draft.status,note:draft.note}});}}>出欠を保存</button></>:person.attendanceNote?<span>{person.attendanceNote}</span>:null}</div>
   </div>;})}</div>}</section>
   <section className={styles.card} id="event-kit" inert={assignmentBusy}><h3>キット</h3><div className={cx('notice','green')}><b>{kitLabel}</b><br/>{!event.kit_settings.enabled?'この開催にキットはありません。':event.kit_settings.recipient==='instructor'?(event.format==='in_person'?'発送先と発送記録を下で確認できます。':'この開催方法では担当講師への発送を記録できません。'):kits.length?`${kits.length}名分の個別発送記録があり、${shipped}名分が発送済みです。`:'個別の発送記録はありません。'}</div>
    {event.kit_settings.enabled&&event.kit_settings.recipient==='instructor'&&event.format==='in_person'?<EventKitShipping key={shippingVersion} headquartersId={headquartersId} eventId={eventId} onChange={setKitShipping} onSaved={()=>void refresh()} onDirtyChange={setShippingDirty} onBusyChange={setShippingBusy}/>:null}
    {kits.map(person=><div className={styles.paymentRow} key={person.key}>{person.name}：{person.application!.headquarters!.shipping.status==='shipped'?'発送済み':'発送準備中'}{person.application!.headquarters!.shipping.trackingNumber?` / 追跡番号 ${person.application!.headquarters!.shipping.trackingNumber}`:''}　{applicationLink(person,'発送内容を見る')}</div>)}
   </section>
   <section className={styles.card} id="event-payments"><h3>当日の支払い</h3>{!data.permissions.finance?<p className={styles.help}>支払い情報の閲覧権限がありません。</p>:<><div className={cx('notice','yellow')}><b>{onsite.length?`${onsite.length}名が当日支払いです。`:'当日支払いの未確認者はいません。'}</b>{onsite.length?<p>会場で受領後に支払いの確認が必要です。</p>:null}</div>{pending.map(person=><div className={styles.paymentRow} key={person.key}>{person.name}：{new Intl.NumberFormat('ja-JP',{style:'currency',currency:person.payment!.currency}).format(person.payment!.amount)} / {paymentMethod(person.payment!.method)}　{applicationLink(person,'申込・支払いを確認')}</div>)}</>}</section>
   <section className={styles.card} id="event-after"><h3>開催後</h3><div className={styles.help}>出欠を保存して開催を終了します。修了・証書・認定は販売プランの設定と受講状況を確認し、申込ごとに進めます。</div><div className={styles.actions}><button className={styles.btn} onClick={()=>jump('event-participants')}>出欠を記録</button><button className={cx('btn','primary')} disabled={busy||shippingBusy||assignmentBusy||loading||dirty||shippingDirty||assignmentDirty||!data.allowedActions.includes('finish_event')} onClick={()=>setConfirmFinish(true)}>開催を終了する →</button></div>{dirty?<p className={styles.help}>入力中の出欠を保存してから終了してください。</p>:data.unconfirmedCount>0?<p className={styles.help}>出欠が未確認の参加者が{data.unconfirmedCount}名います。</p>:null}
    {confirmFinish?<div className={styles.section}><p className={styles.help}>開催を終了し、受付を閉じます。終了後は出欠を変更できません。個別の支払い・修了・認定は変更しません。</p><div className={styles.actions}><button className={cx('btn','primary')} disabled={busy||shippingBusy||assignmentBusy||loading||dirty||shippingDirty||assignmentDirty} onClick={()=>void command({action:'finish_event'})}>確認して開催を終了する</button><button className={styles.btn} disabled={busy} onClick={()=>setConfirmFinish(false)}>戻る</button></div></div>:null}
   </section>
  </div><aside className={cx('card','todo')}><h2>今日の確認</h2><div className={styles.help}>この開催で必要な操作だけを表示します。</div><div className={styles.todoItem}><b>参加者 {participants.length}名</b><p>出欠未確認 {data.unconfirmedCount}名</p><button className={styles.btn} onClick={()=>jump('event-participants')}>参加者を見る</button></div>{data.permissions.finance&&pending.length?<div className={styles.todoItem}><b>支払い確認 {pending.length}名</b><p>入金・当日支払いを確認します。</p><button className={styles.btn} onClick={()=>jump('event-payments')}>支払い確認</button></div>:null}{event.kit_settings.enabled?<div className={styles.todoItem}><b>{kitLabel}</b><p>受け渡し方法と発送状況を確認します。</p><button className={styles.btn} onClick={()=>jump('event-kit')}>キットを見る</button></div>:null}<div className={styles.todoItem}><b>{event.status==='completed'?'開催終了後':'開催後の確認'}</b><p>出欠と申込ごとの受講状況を確認します。</p><button className={cx('btn','primary')} onClick={()=>jump('event-after')}>受講・修了へ</button></div></aside></div>:null}
 </main>;
}
