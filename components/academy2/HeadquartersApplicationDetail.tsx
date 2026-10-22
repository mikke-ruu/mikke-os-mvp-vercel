'use client';
import {useEffect,useRef,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {useAcademy2Headquarters} from './HeadquartersBoundary';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import {commandHeadquartersApplication,getHeadquartersApplication,type HeadquartersApplicationDetail as Detail,type HeadquartersApplicationAction} from '@/lib/academy2/headquarters-applications';
import {getAcademy2Event,type Academy2EventDetail} from '@/lib/academy2/operations';
import {ApplicationAnswerSummary} from './ApplicationAnswerSummary';
import {applicationDate,applicationPaymentLabel,nextActionLabel} from './HeadquartersApplications';
import {confirmApplicationSchedule,applicationScheduleLabel} from '@/lib/academy2/application-schedule';
import styles from './applications-operation.module.css';
const card=styles.detailCard,button=styles.button,primaryButton=styles.button+' '+styles.primary,inputClass=styles.operationInput;
function Row({label,children}:{label:string;children:React.ReactNode}){return <div className={styles.row}><span className={styles.rowLabel}>{label}</span><span className={styles.rowValue}>{children}</span></div>;}
function status(value:string|null|undefined){return ({pending:'入金確認待ち',paid:'入金済み',unpaid:'未払い',shipped:'発送済み',not_required:'不要',submitted:'報告済み',certified:'認定済み',attended:'出席',present:'出席',absent:'欠席',late:'遅刻',unconfirmed:'未確認',confirmed:'確認済み',waiting:'確認待ち',unreported:'未報告',not_started:'未実施',not_certified:'未認定',preparing:'発送準備中',waiting_assignment:'担当講師の確定待ち',awaiting_destination:'講師の発送先指定待ち',blocked:'開催の設定を確認'} as Record<string,string>)[value??'']??'確認中';}
/** Return targets are constructed from this HQ and this application's canonical event, never an arbitrary URL. */
export function applicationBackTarget(hqId:string,eventId:string|null|undefined,params:URLSearchParams){
 if(eventId&&/^[0-9a-f-]{36}$/i.test(eventId)&&params.get('fromEvent')===eventId)return{href:toAcademyContextHref('/academy/classes/'+eventId,hqId,'manage'),label:'← 開催詳細へ戻る'};
 const q=new URLSearchParams();const filter=params.get('listFilter'),channel=params.get('listChannel'),sort=params.get('listSort'),search=params.get('listSearch');
 if(['all','attention','schedule','shipping','payment_pending','completion_pending','completed'].includes(filter??''))q.set('filter',filter!);
 if(['all','headquarters','instructor'].includes(channel??''))q.set('channel',channel!);
 if(['recent','oldest'].includes(sort??''))q.set('sort',sort!);if(search)q.set('q',search.slice(0,200));
 return{href:toAcademyContextHref('/academy/offering-applications'+(q.size?'?'+q.toString():''),hqId,'manage'),label:'← 申込一覧へ戻る'};
}
export function HeadquartersApplicationDetail({applicationId}:{applicationId:string}){const hq=useAcademy2Headquarters();return hq?<ApplicationDetailBody key={hq.id+':'+applicationId} hq={hq} applicationId={applicationId}/>:null;}
function ApplicationDetailBody({hq,applicationId}:{hq:NonNullable<ReturnType<typeof useAcademy2Headquarters>>;applicationId:string}){
 const query=useSearchParams(),[data,setData]=useState<Detail|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[saved,setSaved]=useState('');
 const [note,setNote]=useState(''),[address,setAddress]=useState(''),[tracking,setTracking]=useState(''),[shipped,setShipped]=useState(''),[dirty,setDirty]=useState(false),[retry,setRetry]=useState(0),[copyStatus,setCopyStatus]=useState('');
 const [event,setEvent]=useState<Academy2EventDetail|null>(null),[eventError,setEventError]=useState('');
 const [individualStarts,setIndividualStarts]=useState(''),[individualEnds,setIndividualEnds]=useState('');
 const individualRequest=useRef<{signature:string;id:string}|null>(null);
 const request=useRef<{signature:string;id:string}|null>(null),lock=useRef(false),dirtyFields=useRef(new Set<string>());
 useEffect(()=>{let live=true;setLoading(true);setError('');getHeadquartersApplication(hq.id,applicationId).then(result=>{if(!live)return;setData(result);if(!dirtyFields.current.has('address'))setAddress(result.headquarters?.shipping.address??'');}).catch(cause=>{if(live)setError(cause instanceof Error?cause.message:'申込を読み込めませんでした。');}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[hq.id,applicationId,retry]);
 useEffect(()=>{let live=true;setEvent(null);setEventError('');const id=data?.headquarters?.event?.id;if(id)void getAcademy2Event(hq.id,id).then(v=>{if(live)setEvent(v);}).catch(()=>{if(live)setEventError('開催情報を読み込めませんでした。');});return()=>{live=false;};},[hq.id,data?.headquarters?.event?.id,data?.headquarters?.event?.revision]);
 useEffect(()=>{if(!dirty)return;const guard=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty]);
 useEffect(()=>{if(dirty||busy)return;const refresh=()=>{if(document.visibilityState==='visible')setRetry(v=>v+1);};window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[dirty,busy]);
 useEffect(()=>{const row=data?.headquarters?.individualSchedule;const local=(v:string|null)=>v?new Date(Date.parse(v)+9*3600000).toISOString().slice(0,16):'';if(!dirtyFields.current.has('individualStarts'))setIndividualStarts(local(row?.startsAt??null));if(!dirtyFields.current.has('individualEnds'))setIndividualEnds(local(row?.endsAt??null));},[data?.headquarters?.individualSchedule]);
 useEffect(()=>{if(!copyStatus)return;const timer=setTimeout(()=>setCopyStatus(''),3500);return()=>clearTimeout(timer);},[copyStatus]);
 function edit(set:(value:string)=>void,value:string){set(value);dirtyFields.current.add(set===setNote?'note':set===setAddress?'address':set===setTracking?'tracking':set===setIndividualStarts?'individualStarts':set===setIndividualEnds?'individualEnds':'shipped');setDirty(true);setSaved('');}
 function leave(){return !lock.current&&(!dirty||window.confirm('保存していない入力があります。画面を移動しますか？'));}
 async function execute(action:HeadquartersApplicationAction,input:Record<string,unknown>={}){
  if(!data||lock.current||loading||!(data.headquarters?.allowedActions??data.instructor?.allowedActions??[]).includes(action))return;
  lock.current=true;setBusy(true);setError('');setSaved('');const signature=JSON.stringify([applicationId,data.summary.revision,action,input]);if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};
  try{const result=await commandHeadquartersApplication(hq.id,applicationId,data.summary.revision,request.current.id,action,input);setData(result);request.current=null;
   if(action==='set_shipping_destination')dirtyFields.current.delete('address');if(action==='record_shipping'){dirtyFields.current.delete('tracking');dirtyFields.current.delete('shipped');}if(Object.hasOwn(input,'review_note'))dirtyFields.current.delete('note');setDirty(dirtyFields.current.size>0);setSaved('保存しました');
  }catch(cause){setError(cause instanceof Error?cause.message:'保存できませんでした。入力内容は残っています。');}finally{lock.current=false;setBusy(false);}
 }
 async function saveIndividualSchedule(){
  const row=data?.headquarters?.individualSchedule;if(!data||!row||!data.headquarters?.scheduleWritable||lock.current||loading)return;
  const starts=individualStarts?new Date(individualStarts+':00+09:00'):null,ends=individualEnds?new Date(individualEnds+':00+09:00'):null;
  if(!starts||!ends||!Number.isFinite(starts.getTime())||!Number.isFinite(ends.getTime())||ends<=starts){setError('開始日時と、その後の終了日時を入力してください。');return;}
  const signature=JSON.stringify([applicationId,row.revision,starts.toISOString(),ends.toISOString()]);if(individualRequest.current?.signature!==signature)individualRequest.current={signature,id:crypto.randomUUID()};
  lock.current=true;setBusy(true);setError('');setSaved('');try{const result=await confirmApplicationSchedule(hq.id,applicationId,row.revision,individualRequest.current.id,starts.toISOString(),ends.toISOString());setData(result);individualRequest.current=null;dirtyFields.current.delete('individualStarts');dirtyFields.current.delete('individualEnds');setDirty(dirtyFields.current.size>0);setSaved('保存しました');}catch(cause){setError(cause instanceof Error?cause.message:'日程を保存できませんでした。入力内容は残っています。');}finally{lock.current=false;setBusy(false);}
 }
 if(!data)return <div className={styles.wrap}><p role={error?'alert':'status'}>{error||'読み込み中…'}</p>{error&&<button className={button} onClick={()=>setRetry(v=>v+1)}>再読み込み</button>}</div>;
 const {summary,headquarters,instructor}=data,individual=headquarters?.individualSchedule,view=instructor?.view,allowed=headquarters?.allowedActions??instructor?.allowedActions??[];
 const shipping=headquarters?.shipping??{required:view?.kit?.required,status:view?.kit?.status,address:instructor?.details.shippingAddress??instructor?.details.kitDestination?.selectedAddress,shippedAt:instructor?.details.shippedAt,trackingNumber:instructor?.details.trackingNumber};
 const eventId=headquarters?.event?.id,back=applicationBackTarget(hq.id,eventId,new URLSearchParams(query.toString())),email=headquarters?.contactEmail??view?.contact?.email;
 const href=(path:string)=>toAcademyContextHref(path,hq.id,'manage');
 const eventLink=eventId?<a className={styles.textLink} href={href('/academy/classes/'+eventId)} onClick={e=>{if(!leave())e.preventDefault();}}>開催詳細を確認</a>:null;
 const shippingEventId=headquarters?.shipping.eventId??eventId,eventKit=headquarters?.shipping.recipient==='instructor';
 const starts=headquarters?.event?.startsAt??view?.schedule?.startsAt,ends=headquarters?.event?.endsAt??view?.schedule?.endsAt;
 const arranged=!!individual||event?.schedule_mode==='arranged_after_application'||view?.schedule?.mode==='arranged_after_application';
 const paymentReviewRequired=summary.saleChannel==='headquarters'&&['onsite','external'].includes(summary.tuition?.method??'');
 const needsNote=!!headquarters&&((paymentReviewRequired&&allowed.includes('confirm_payment'))||allowed.includes('confirm_completion'));
 const next=['confirm_certification','review_outcome'].includes(summary.nextAction??'')?'認定機能は準備中です。':summary.nextAction===null&&summary.completedAt?'対応完了':nextActionLabel(summary.nextAction);
 async function copyEmail(){if(!email)return;try{await navigator.clipboard.writeText(email);setCopyStatus('コピーしました');}catch{setCopyStatus('コピーできませんでした。メールアドレスを選択してコピーしてください。');}}
 const emailView=email?<div className={styles.emailRow}><span>{email}</span><button type="button" className={styles.iconButton} aria-label="メールアドレスをコピー" onClick={()=>void copyEmail()}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg></button><span role="status" className={styles.copyStatus}>{copyStatus}</span></div>:null;
 return <div className={styles.wrap}>
  <a className={styles.backLink} href={back.href} onClick={e=>{if(!leave())e.preventDefault();}}>{back.label}</a>
  <div className={styles.heroTitle}><div className={styles.en}>APPLICATION</div><h1 className={styles.jp}>申込詳細</h1></div><div className={styles.detailIntro}><p>申込内容と対応状況を確認します。</p><button className={styles.iconButton} type="button" aria-label="申込情報を更新" disabled={busy||loading} onClick={()=>{setSaved('');setRetry(v=>v+1);}}>↻</button></div>
  <div className={styles.finalDetail}>
   <ApplicationAnswerSummary applicationId={applicationId} className={card} basicRows={[{id:'plan',label:'販売プラン',value:headquarters?.sales_plan_id&&/^[0-9a-f-]{36}$/i.test(headquarters.sales_plan_id)?<a className={styles.textLink} href={href('/academy/offerings/'+headquarters.sales_plan_id)} target="_blank" rel="noopener noreferrer" aria-label={'現在の販売プランを確認：'+summary.planTitle+'（別タブ）'}>{summary.planTitle} ↗</a>:summary.planTitle},{id:'appliedAt',label:'申込日時',value:applicationDate(summary.appliedAt)},{id:'name',label:'申込者名',value:summary.applicantName},{id:'email',label:'メールアドレス',value:emailView},{id:'phone',label:'電話番号'},{id:'price',label:'受講料',value:summary.tuition?new Intl.NumberFormat('ja-JP',{style:'currency',currency:summary.tuition.currency||'JPY'}).format(summary.tuition.amount):'閲覧権限を確認してください'}]} reservedAnswers={{terms:headquarters?.consented_at&&headquarters.consent_version?'同意済み（'+applicationDate(headquarters.consented_at)+'／'+headquarters.consent_version+'）':undefined}}/>
   <section className={card}><h2>運営側の対応状況</h2>
    {summary.tuition&&<Row label="入金状態">{applicationPaymentLabel(summary.tuition.status)}</Row>}
    {!individual&&(eventId||view?.schedule)?<><Row label="開催日時">{starts?<>{applicationDate(starts)}{ends?' 〜 '+applicationDate(ends):''}</>:arranged?'日程相談中':'未確定'}</Row>{eventId&&<Row label="開催">{eventLink}</Row>}{arranged&&<Row label="日程調整">{starts?'日時確定':'相談中'}</Row>}{eventError&&<p role="alert">{eventError}</p>}</>:null}
    {individual&&eventLink&&<Row label="募集">{eventLink}</Row>}
    {view?.completion?.attendance&&<Row label="出欠">{status(view.completion.attendance)}</Row>}
    <Row label="修了">{summary.completedAt?'修了済み（'+applicationDate(summary.completedAt)+'）':'未記録'}</Row>{view?.completion?.report&&<Row label="修了報告">{status(view.completion.report)}</Row>}{summary.certifiedAt&&<Row label="認定記録">{applicationDate(summary.certifiedAt)}</Row>}
    {individual&&<div className={styles.operationSection}><h3>個別の日程</h3><p>{({consulting:'日程相談中',confirmed:'日程確定',changed:'日程変更あり'}[individual.state])}</p>{!headquarters?.scheduleWritable&&<p>{applicationScheduleLabel(summary.schedule)}</p>}{headquarters?.scheduleWritable&&<div className={styles.individualEditor}><div className={styles.individualDates}><label>開始日時<input type="datetime-local" className={inputClass} value={individualStarts} disabled={busy||loading} onChange={e=>edit(setIndividualStarts,e.target.value)}/></label><label>終了日時<input type="datetime-local" className={inputClass} value={individualEnds} disabled={busy||loading} onChange={e=>edit(setIndividualEnds,e.target.value)}/></label></div><p>この申込者の日程だけを保存します。お客様への連絡は普段のメールで行ってください。</p><button type="button" className={primaryButton} disabled={busy||loading||!individualStarts||!individualEnds} onClick={()=>void saveIndividualSchedule()}>{individual.startsAt?'日程の変更を保存する':'日程を確定する'}</button></div>}</div>}
    <div className={styles.operationSection}><h3>次に対応すること</h3><p>{next}</p>
     {!individual&&summary.nextAction==='confirm_schedule'&&eventId&&<p className={styles.scheduleNotice}>日程の変更は同じ開催の参加者全員に反映されます。{eventLink}</p>}
     {allowed.includes('confirm_payment')&&<button className={primaryButton} disabled={busy||loading||(paymentReviewRequired&&!note.trim())} onClick={()=>void execute('confirm_payment',paymentReviewRequired?{review_note:note}:{})}>入金を確認する</button>}
     {needsNote&&<label>確認内容<textarea className={inputClass} maxLength={2000} value={note} onChange={e=>edit(setNote,e.target.value)}/></label>}
     {allowed.includes('confirm_completion')&&<button className={primaryButton} disabled={busy||loading||!note.trim()} onClick={()=>void execute('confirm_completion',{review_note:note})}>修了を記録する</button>}
    </div>
    {shipping.required&&<div className={styles.operationSection}><h3>物品の受け渡し</h3><Row label="発送状態">{status(shipping.status)}</Row>{shipping.shippedAt&&<Row label="発送日">{applicationDate(shipping.shippedAt)}</Row>}
     {eventKit?<><p>担当講師へまとめて発送する物品です。</p>{shippingEventId&&<a className={styles.textLink} href={href('/academy/classes/'+shippingEventId)} onClick={e=>{if(!leave())e.preventDefault();}}>開催の発送状況を確認</a>}</>:<><Row label="発送先">{shipping.address??''}</Row>{shipping.trackingNumber&&<Row label="追跡番号">{shipping.trackingNumber}</Row>}
      {allowed.includes('set_shipping_destination')&&<><label>発送先の確認・変更<textarea className={inputClass} value={address} onChange={e=>edit(setAddress,e.target.value)}/></label><button className={button} disabled={busy||loading||!address.trim()} onClick={()=>void execute('set_shipping_destination',{address})}>発送先を保存する</button></>}
      {allowed.includes('record_shipping')&&<><label>発送日時<input type="datetime-local" className={inputClass} value={shipped} onChange={e=>edit(setShipped,e.target.value)}/></label><label>追跡番号（任意）<input className={inputClass} value={tracking} onChange={e=>edit(setTracking,e.target.value)}/></label><button className={primaryButton} disabled={busy||loading||!shipped||!shipping.address} onClick={()=>void execute('record_shipping',{shippedAt:new Date(shipped+':00+09:00').toISOString(),trackingNumber:tracking||undefined})}>発送済みにする</button></>}
     </>}
    </div>}
    <div aria-live="polite" className={styles.inlineFeedback}>{busy?<p role="status">保存中…</p>:error?<p role="alert" className={styles.error}>{error}</p>:saved?<p role="status">{saved}</p>:dirty?<p role="status">未保存の入力があります。</p>:null}</div>
   </section>
  </div>
 </div>;
}
