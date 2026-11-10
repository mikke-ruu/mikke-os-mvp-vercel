'use client';
import {useEffect,useRef,useState} from 'react';
import {GuestApplicationDetail} from './GuestApplicationDetail';
import {useSearchParams} from 'next/navigation';
import {useAcademy2Headquarters} from './HeadquartersBoundary';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import {commandHeadquartersApplication,getHeadquartersApplication,recordHeadquartersShipment,type HeadquartersApplicationDetail as Detail,type HeadquartersApplicationAction} from '@/lib/academy2/headquarters-applications';
import {ApplicationHistory} from './ApplicationHistory';
import {ApplicationMailStatus} from './ApplicationMailStatus';
import {ApplicationRecordCorrections,ShipmentCopyActions} from './ApplicationRecordCorrections';
import {InternalNoteEditor} from './InternalNoteEditor';
import {getAcademy2Event,type Academy2EventDetail} from '@/lib/academy2/operations';
import {ApplicationOverview} from './ApplicationOverview';
import {ApplicationAnswerSummary} from './ApplicationAnswerSummary';
import {applicationCompleted,applicationDate,applicationPaymentLabel,nextActionLabel} from './HeadquartersApplications';
import {confirmApplicationSchedule,applicationScheduleLabel} from '@/lib/academy2/application-schedule';
import {shipmentCarriers,shipmentCarrierLabel,japanDate,paymentMethodLabel} from '@/lib/academy2/shipment-display';
import styles from './applications-operation.module.css';
const card=styles.detailCard,button=styles.button,primaryButton=styles.button+' '+styles.primary,inputClass=styles.operationInput;
function Row({label,children}:{label:string;children:React.ReactNode}){return <div className={styles.row}><span className={styles.rowLabel}>{label}</span><span className={styles.rowValue}>{children}</span></div>;}
function status(value:string|null|undefined){return ({pending:'入金確認待ち',paid:'入金済み',unpaid:'未払い',shipped:'発送済み',not_required:'不要',submitted:'報告済み',certified:'認定済み',attended:'出席',present:'出席',absent:'欠席',late:'遅刻',unconfirmed:'未確認',confirmed:'確認済み',waiting:'確認待ち',unreported:'未報告',not_started:'未実施',not_certified:'未認定',preparing:'発送準備中',waiting_assignment:'担当講師の確定待ち',awaiting_destination:'講師の発送先指定待ち',blocked:'開催の設定を確認'} as Record<string,string>)[value??'']??'確認中';}
/** The original submission stays in its original table. Only the server authorizes historical updates. */
function HistoricalApplicationDetail({data,headquartersId,params,busy,error,saved,note,setNote,leave,refresh,execute}:{data:Detail;headquartersId:string;params:URLSearchParams;busy:boolean;error:string;saved:string;note:string;setNote:(value:string)=>void;leave:()=>boolean;refresh:()=>void;execute:(action:HeadquartersApplicationAction,input?:Record<string,unknown>)=>Promise<void>}){
 const legacy=data.legacy!,summary=data.summary,back=applicationBackTarget(headquartersId,legacy.reference.eventId,params);
 const [copyStatus,setCopyStatus]=useState('');
 const allowed=legacy.allowedActions;
 const act=(action:'confirm_payment'|'confirm_completion')=>{const label=action==='confirm_payment'?'この申込の入金を確認しますか？':'この申込の修了を記録しますか？';if(window.confirm(label))void execute(action,{review_note:note.trim()});};
 return <div className={styles.wrap}>
  <a className={styles.backLink} href={back.href} onClick={event=>{if(!leave())event.preventDefault();}}>{back.label}</a>
  <div className={styles.heroTitle}><div className={styles.en}>APPLICATION</div><h1 className={styles.jp}>申込詳細</h1></div>
  <div className={styles.detailIntro}><p>申込内容と対応状況を確認します。</p><button className={styles.iconButton} type="button" aria-label="申込情報を更新" disabled={busy} onClick={refresh}>↻</button></div>
  <div className={styles.finalDetail}>
   <ApplicationOverview summary={summary} actionAvailable={allowed.length>0}/>
   <section className={`${card} ${styles.answers}`}><h2>お客様の入力内容</h2>
    <div className={styles.basicAnswers}>
     <Row label="申込者名">{summary.applicantName}</Row>
     <Row label="メールアドレス">{legacy.contactEmail&&<div className={styles.emailRow}><span>{legacy.contactEmail}</span><button type="button" className={styles.iconButton} aria-label="メールアドレスをコピー" onClick={()=>{void navigator.clipboard.writeText(legacy.contactEmail!).then(()=>setCopyStatus('コピーしました')).catch(()=>setCopyStatus('コピーできませんでした。メールアドレスを選択してコピーしてください。'));}}>コピー</button><span role="status" className={styles.copyStatus}>{copyStatus}</span></div>}</Row>
     {legacy.phone&&<Row label="電話番号">{legacy.phone}</Row>}
    </div>
    <dl className={styles.questionAnswers}>{legacy.answers.map((answer,index)=><div key={index}><dt className={styles.answerLabel}>{answer.label}</dt><dd className={styles.answerValue}>{answer.value??<span aria-label="回答なし">&nbsp;</span>}</dd></div>)}</dl>
    {legacy.consent&&<Row label="規約への同意">{legacy.consent.consentedAt?applicationDate(legacy.consent.consentedAt):'日時の記録なし'}{legacy.consent.version?' ／ '+legacy.consent.version:''}</Row>}
   </section>
   <section id="application-operations" className={card}><h2>運営側の対応</h2>
    {summary.tuition&&<><Row label="お支払い方法">{paymentMethodLabel(summary.tuition.method)}</Row><Row label="入金状態">{applicationPaymentLabel(summary.tuition.status)}</Row></>}
    <Row label="修了">{summary.completedAt?'修了済み（'+applicationDate(summary.completedAt)+'）':legacy.completed===true||applicationCompleted(summary)?'修了済み（日時の記録なし）':'未記録'}</Row>
    {summary.kitStatus&&summary.kitStatus!=='not_required'&&<Row label="教材・材料の受け渡し">{status(summary.kitStatus)}</Row>}
    {allowed.length>0?<div className={styles.operationSection}><h3>次に対応すること</h3><p>{nextActionLabel(summary.nextAction)}</p><label>確認内容<textarea className={inputClass} maxLength={2000} value={note} disabled={busy} onChange={event=>setNote(event.target.value)}/></label>
     {allowed.includes('confirm_payment')&&<button type="button" className={primaryButton} disabled={busy||!note.trim()} onClick={()=>act('confirm_payment')}>入金を確認する</button>}
     {allowed.includes('confirm_completion')&&<button type="button" className={primaryButton} disabled={busy||!note.trim()} onClick={()=>act('confirm_completion')}>修了を記録する</button>}
    </div>:<p>過去の申込記録です。</p>}
    <div aria-live="polite" className={styles.inlineFeedback}>{busy?<p role="status">確認中…</p>:error?<p role="alert" className={styles.error}>{error}</p>:saved?<p role="status">{saved}</p>:null}</div>
   </section>
  </div>
 </div>;
}
/** Return targets are constructed from this HQ and this application's canonical event, never an arbitrary URL. */
export function applicationBackTarget(hqId:string,eventId:string|null|undefined,params:URLSearchParams){
 const person=params.get('fromParticipant');if(person&&/^(user|unlinked):[0-9a-f-]{36}$/i.test(person))return{href:toAcademyContextHref('/academy/participants?person='+encodeURIComponent(person),hqId,'manage'),label:'← 受講者詳細へ戻る'};
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
 const [note,setNote]=useState(''),[address,setAddress]=useState(''),[tracking,setTracking]=useState(''),[shipped,setShipped]=useState(japanDate),[dirty,setDirty]=useState(false),[retry,setRetry]=useState(0),[copyStatus,setCopyStatus]=useState('');
 const [carrier,setCarrier]=useState(''),[carrierOther,setCarrierOther]=useState(''),[addressEditing,setAddressEditing]=useState(false);
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
 function edit(set:(value:string)=>void,value:string){set(value);dirtyFields.current.add(set===setNote?'note':set===setAddress?'address':set===setTracking?'tracking':set===setCarrier?'carrier':set===setCarrierOther?'carrierOther':set===setIndividualStarts?'individualStarts':set===setIndividualEnds?'individualEnds':'shipped');setDirty(true);setSaved('');}
 function leave(){return !lock.current&&(!dirty||window.confirm('保存していない入力があります。画面を移動しますか？'));}
 async function execute(action:HeadquartersApplicationAction,input:Record<string,unknown>={}){
  if(!data||lock.current||loading||!(data.legacy?.allowedActions??data.headquarters?.allowedActions??data.instructor?.allowedActions??[]).includes(action))return;
  lock.current=true;setBusy(true);setError('');setSaved('');const signature=JSON.stringify([applicationId,data.summary.revision,action,input]);if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};
  try{if(action==='record_shipping'&&data.headquarters)await recordHeadquartersShipment(hq.id,applicationId,data.summary.revision,request.current.id,input as {date:string;carrier:string;trackingNumber:string});else await commandHeadquartersApplication(hq.id,applicationId,data.summary.revision,request.current.id,action,input);
   setData(await getHeadquartersApplication(hq.id,applicationId));request.current=null;
   if(action==='set_shipping_destination'){dirtyFields.current.delete('address');setAddressEditing(false);}if(action==='record_shipping'){dirtyFields.current.delete('tracking');dirtyFields.current.delete('shipped');dirtyFields.current.delete('carrier');dirtyFields.current.delete('carrierOther');}if(Object.hasOwn(input,'review_note'))dirtyFields.current.delete('note');setDirty(dirtyFields.current.size>0);setSaved(action==='confirm_payment'?'入金済みにしました':action==='record_shipping'?'発送済みにしました':action==='set_shipping_destination'?'発送先を確認しました':'保存しました');
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
 if(data.guest)return <GuestApplicationDetail initial={data}/>;
 if(data.legacy)return <HistoricalApplicationDetail data={data} headquartersId={hq.id} params={new URLSearchParams(query.toString())} busy={busy||loading} error={error} saved={saved} note={note} setNote={value=>edit(setNote,value)} leave={leave} refresh={()=>setRetry(v=>v+1)} execute={execute}/>;
 if(data.summary.source==='legacy_course'||data.summary.source==='legacy_plan')return <div className={styles.wrap}><p role="alert">過去の申込内容を確認できませんでした。再読み込みしてください。</p><button className={button} onClick={()=>setRetry(v=>v+1)}>再読み込み</button></div>;
 const {summary,headquarters,instructor}=data,individual=headquarters?.individualSchedule,view=instructor?.view,allowed=headquarters?.allowedActions??instructor?.allowedActions??[];
 const shipping=headquarters?.shipping??{required:view?.kit?.required,status:view?.kit?.status,address:instructor?.details.shippingAddress??instructor?.details.kitDestination?.selectedAddress,shippedAt:instructor?.details.shippedAt,trackingNumber:instructor?.details.trackingNumber};
 const eventId=headquarters?.event?.id,back=applicationBackTarget(hq.id,eventId,new URLSearchParams(query.toString())),email=headquarters?.contactEmail??view?.contact?.email;
 const href=(path:string)=>toAcademyContextHref(path,hq.id,'manage');
 const eventLink=eventId?<a className={styles.textLink} href={href('/academy/classes/'+eventId)} onClick={e=>{if(!leave())e.preventDefault();}}>開催詳細を確認</a>:null;
 const shippingEventId=headquarters?.shipping.eventId??eventId,eventKit=headquarters?.shipping.recipient==='instructor';
 const starts=headquarters?.event?.startsAt??view?.schedule?.startsAt,ends=headquarters?.event?.endsAt??view?.schedule?.endsAt;
 const arranged=!!individual||event?.schedule_mode==='arranged_after_application'||view?.schedule?.mode==='arranged_after_application';
 const paymentReviewRequired=summary.saleChannel==='headquarters'&&['onsite','external'].includes(summary.tuition?.method??'');
 const needsNote=!!headquarters&&((summary.nextAction==='confirm_payment'&&paymentReviewRequired&&allowed.includes('confirm_payment'))||(summary.nextAction==='confirm_completion'&&allowed.includes('confirm_completion')));
 const next=['confirm_certification','review_outcome'].includes(summary.nextAction??'')?'認定機能は準備中です。':summary.nextAction===null&&summary.completedAt?'対応完了':nextActionLabel(summary.nextAction);
 async function copyEmail(){if(!email)return;try{await navigator.clipboard.writeText(email);setCopyStatus('コピーしました');}catch{setCopyStatus('コピーできませんでした。メールアドレスを選択してコピーしてください。');}}
 const emailView=email?<div className={styles.emailRow}><span>{email}</span><button type="button" className={styles.iconButton} aria-label="メールアドレスをコピー" onClick={()=>void copyEmail()}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg></button><span role="status" className={styles.copyStatus}>{copyStatus}</span></div>:null;
 return <div className={styles.wrap}>
  <a className={styles.backLink} href={back.href} onClick={e=>{if(!leave())e.preventDefault();}}>{back.label}</a>
  <div className={styles.heroTitle}><div className={styles.en}>APPLICATION</div><h1 className={styles.jp}>申込詳細</h1></div><div className={styles.detailIntro}><p>申込内容と対応状況を確認します。</p><button className={styles.iconButton} type="button" aria-label="申込情報を更新" disabled={busy||loading} onClick={()=>{setSaved('');setRetry(v=>v+1);}}>↻</button></div>
  <div className={styles.finalDetail}>
   <ApplicationOverview summary={summary} plan={headquarters?.sales_plan_id&&/^[0-9a-f-]{36}$/i.test(headquarters.sales_plan_id)?<a className={styles.textLink} href={href('/academy/offerings/'+headquarters.sales_plan_id)} target="_blank" rel="noopener noreferrer" aria-label={'現在の販売プランを確認：'+summary.planTitle+'（別タブ）'}>{summary.planTitle} ↗</a>:summary.planTitle} venue={headquarters?.event?headquarters.event.format==='online'?'オンライン':headquarters.event.venueName?'対面 ／ '+headquarters.event.venueName:'対面':undefined} materials={data.workspace?.eventFacts?.materials??(shipping.required?'教材・材料の発送あり':'教材・材料の発送なし')} assignee={data.workspace?.eventFacts?.assignee??'担当者の記録なし'} actionAvailable={allowed.length>0}/>
   {eventError&&<p role="alert">{eventError}</p>}
   {summary.participantKey&&<a className={styles.textLink} href={href('/academy/participants?person='+encodeURIComponent(summary.participantKey))} onClick={e=>{if(!leave())e.preventDefault();}}>この方の受講履歴を見る →</a>}
   <ApplicationAnswerSummary applicationId={applicationId} className={card} heading="お客様の入力内容" basicRows={[{id:'name',label:'お名前',value:summary.applicantName},{id:'email',label:'メールアドレス',value:emailView},{id:'phone',label:'電話番号'}]} reservedAnswers={{terms:headquarters?.consented_at&&headquarters.consent_version?'同意済み（'+applicationDate(headquarters.consented_at)+'／'+headquarters.consent_version+'）':undefined}}/>
   <section id="application-operations" className={card}><h2>運営側の対応</h2>
    {saved==='入金済みにしました'&&<p role="status" className={styles.inlineFeedback}>{saved}</p>}
    {view?.completion?.attendance&&<Row label="出欠">{status(view.completion.attendance)}</Row>}
    <Row label="受講の完了">{summary.completedAt?'受講完了（'+applicationDate(summary.completedAt)+'）':'まだ完了していません'}</Row>{view?.completion?.report&&<Row label="受講完了の報告">{status(view.completion.report)}</Row>}{summary.certifiedAt&&<Row label="認定記録">{applicationDate(summary.certifiedAt)}</Row>}
    {individual&&<div className={styles.operationSection}><h3>個別の日程</h3><p>{({consulting:'日程相談中',confirmed:'日程確定',changed:'日程変更あり'}[individual.state])}</p>{!headquarters?.scheduleWritable&&<p>{applicationScheduleLabel(summary.schedule)}</p>}{headquarters?.scheduleWritable&&<div className={styles.individualEditor}><div className={styles.individualDates}><label>開始日時<input type="datetime-local" className={inputClass} value={individualStarts} disabled={busy||loading} onChange={e=>edit(setIndividualStarts,e.target.value)}/></label><label>終了日時<input type="datetime-local" className={inputClass} value={individualEnds} disabled={busy||loading} onChange={e=>edit(setIndividualEnds,e.target.value)}/></label></div><p>この申込者の日程だけを保存します。お客様への連絡は普段のメールで行ってください。</p><button type="button" className={primaryButton} disabled={busy||loading||!individualStarts||!individualEnds} onClick={()=>void saveIndividualSchedule()}>{individual.startsAt?'日程の変更を保存する':'日程を確定する'}</button></div>}</div>}
    {(!shipping.required||!['set_shipping_destination','record_shipping','ship_kit','event_kit_shipping'].includes(summary.nextAction??''))&&<div className={styles.operationSection}><h3>{summary.nextAction==='confirm_payment'?'入金の確認':'次に対応すること'}</h3>
     {summary.nextAction!=='confirm_payment'&&<p>{next}</p>}
     {!individual&&summary.nextAction==='confirm_schedule'&&eventId&&<p className={styles.scheduleNotice}>日程の変更は同じ開催の参加者全員に反映されます。{eventLink}</p>}
     {allowed.includes('confirm_payment')&&<><p>{summary.tuition?.method==='bank'?'銀行口座への振込を確認できたら、入金済みにしてください。':summary.tuition?.method==='external'?'決済サービスの管理画面で支払いを確認してから、入金済みにしてください。':'受講料の受け取りを確認してから、入金済みにしてください。'}</p>{needsNote&&<label>確認した支払いの内容<textarea className={inputClass} maxLength={2000} value={note} onChange={e=>edit(setNote,e.target.value)}/></label>}<button className={primaryButton} disabled={busy||loading||(paymentReviewRequired&&!note.trim())} onClick={()=>void execute('confirm_payment',paymentReviewRequired?{review_note:note}:{})}>入金済みにする</button></>}
     {summary.nextAction==='confirm_completion'&&allowed.includes('confirm_completion')&&<><p>受講が終わったことを確認して、完了にしてください。</p><button className={primaryButton} disabled={busy||loading} onClick={()=>{if(window.confirm('この方の受講を完了にしますか？ 受講後に公開する教材がある場合は、ここから閲覧期間が始まります。'))void execute('confirm_completion',{});}}>受講を完了にする</button></>}
    </div>}
    {shipping.required&&<div className={styles.operationSection}><h3>教材・材料の発送</h3><Row label="発送状況">{status(shipping.status)}</Row>{shipping.shippedAt&&<Row label="発送日">{'shippedDate' in shipping&&shipping.shippedDate?shipping.shippedDate.replaceAll('-','/'):japanDate(shipping.shippedAt).replaceAll('-','/')}</Row>}
     {eventKit?<><p>担当講師へまとめて発送する物品です。</p>{shippingEventId&&<a className={styles.textLink} href={href('/academy/classes/'+shippingEventId)} onClick={e=>{if(!leave())e.preventDefault();}}>開催の発送状況を確認</a>}</>:<><Row label="発送先">{shipping.address||'発送先が登録されていません'}</Row>{shipping.shippedAt&&<Row label="配送会社">{shipmentCarrierLabel('carrier' in shipping?shipping.carrier:undefined)}</Row>}{shipping.trackingNumber&&<Row label="追跡番号">{shipping.trackingNumber}</Row>}{headquarters&&shipping.shippedAt&&<ShipmentCopyActions data={data}/>}
      {allowed.includes('set_shipping_destination')&&<>
       {summary.nextAction==='set_shipping_destination'&&!addressEditing&&<><p>お申し込み時の発送先です。内容を確認して進めてください。</p><button type="button" className={primaryButton} disabled={busy||loading||!address.trim()} onClick={()=>void execute('set_shipping_destination',{address})}>この発送先で進める</button></>}
       <button type="button" className={styles.textButton} disabled={busy||loading} aria-expanded={addressEditing} onClick={()=>setAddressEditing(value=>!value)}>{addressEditing?'住所の入力欄を閉じる':'発送先を変更する'}</button>
       {addressEditing&&<div className={styles.shippingEditor}><label>発送先の住所・宛名<textarea className={inputClass} value={address} onChange={e=>edit(setAddress,e.target.value)}/></label><button type="button" className={button} disabled={busy||loading||!address.trim()} onClick={()=>void execute('set_shipping_destination',{address})}>発送先を保存して確認する</button></div>}
      </>}
      {allowed.includes('record_shipping')&&(headquarters?<div className={styles.shippingEditor} role="group" aria-label="発送情報"><p>教材・材料を発送したら、配送情報を記録してください。</p><div className={styles.shippingFields}><label>配送会社・配送方法<select aria-label="配送会社・配送方法" className={inputClass} value={carrier} onChange={e=>edit(setCarrier,e.target.value)}><option value="">選んでください</option>{shipmentCarriers.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>{carrier==='other'&&<label>配送会社・配送方法の名前<input className={inputClass} maxLength={94} value={carrierOther} onChange={e=>edit(setCarrierOther,e.target.value)}/></label>}{carrier!=='untracked'&&<label>追跡番号<input className={inputClass} value={tracking} maxLength={200} onChange={e=>edit(setTracking,e.target.value)}/></label>}<label>発送日<input type="date" className={inputClass} max={japanDate()} value={shipped} onChange={e=>edit(setShipped,e.target.value)}/></label></div><button type="button" className={primaryButton} disabled={busy||loading||!carrier||carrier==='other'&&!carrierOther.trim()||carrier!=='untracked'&&!tracking.trim()||!shipping.address} onClick={()=>void execute('record_shipping',{date:shipped,carrier:carrier==='other'?'other:'+carrierOther.trim():carrier,trackingNumber:carrier==='untracked'?'':tracking.trim()})}>発送済みにする</button></div>:<><label>発送日<input type="date" className={inputClass} max={japanDate()} value={shipped} onChange={e=>edit(setShipped,e.target.value)}/></label><label>追跡番号（任意）<input className={inputClass} value={tracking} maxLength={200} onChange={e=>edit(setTracking,e.target.value)}/></label><button className={primaryButton} disabled={busy||loading||!shipped||!shipping.address} onClick={()=>void execute('record_shipping',{shippedAt:new Date(shipped+'T00:00:00+09:00').toISOString(),trackingNumber:tracking||undefined})}>発送済みにする</button></>)}
     </>}
    </div>}
    <div aria-live="polite" className={styles.inlineFeedback}>{busy?<p role="status">保存中…</p>:error?<p role="alert" className={styles.error}>{error}</p>:saved&&saved!=='入金済みにしました'?<p role="status">{saved}</p>:dirty?<p role="status">未保存の入力があります。</p>:null}</div>
   </section>
   <ApplicationMailStatus hq={hq.id} applicationId={applicationId} refreshKey={data.summary.revision}/><ApplicationRecordCorrections data={data} hq={hq.id} disabled={busy||loading} onChange={value=>{setData(value);setSaved('');}} onBusyChange={value=>{lock.current=value;setBusy(value);if(value){setSaved('');setError('');}}}/>
   {data.workspace&&<><section className={card}><h2>運営メモ</h2>{data.workspace.canWriteNote?<InternalNoteEditor hq={hq.id} subject={'application:'+applicationId} onSaved={()=>setRetry(v=>v+1)}/>:<p>運営担当の方がメモを記入できます。</p>}</section><ApplicationHistory items={data.workspace.history}/></>}
  </div>
 </div>;
}
