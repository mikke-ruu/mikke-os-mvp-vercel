'use client';
import {useEffect,useRef,useState} from 'react';
import {getEventKitShipping,recordEventKitShipping,type EventKitShippingView} from '@/lib/academy2/event-kit-shipping';
import styles from './event-detail.module.css';
const localNow=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,23);
const time=(value:string)=>new Date(value).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'});
const remaining=(view:EventKitShippingView)=>{const sent=new Set(view.shipments.filter(s=>s.currentRecipient).flatMap(s=>s.participants.map(p=>p.key)));return view.roster.filter(p=>!sent.has(p.key));};
export function EventKitShipping({headquartersId,eventId,onChange,onSaved,onDirtyChange,onBusyChange}:{headquartersId:string;eventId:string;onChange?:(view:EventKitShippingView)=>void;onSaved?:()=>void;onDirtyChange?:(dirty:boolean)=>void;onBusyChange?:(busy:boolean)=>void}){
 const [view,setView]=useState<EventKitShippingView|null>(null),[keys,setKeys]=useState<string[]>([]),[shippedAt,setShippedAt]=useState(localNow),[tracking,setTracking]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[dirty,setDirty]=useState(false);
 const flight=useRef(false),live=useRef(true),generation=useRef(0),request=useRef<{signature:string;id:string}|null>(null),callbacks=useRef({onChange,onSaved,onDirtyChange,onBusyChange});callbacks.current={onChange,onSaved,onDirtyChange,onBusyChange};
 async function refresh(){if(flight.current)return;const serial=++generation.current;setLoading(true);setError('');try{const next=await getEventKitShipping(headquartersId,eventId);if(!live.current||serial!==generation.current)return;setView(next);callbacks.current.onChange?.(next);if(!view&&!dirty)setKeys(remaining(next).map(p=>p.key));request.current=null;}catch(cause){if(live.current&&serial===generation.current)setError(cause instanceof Error?cause.message:'発送情報を読み込めませんでした。');}finally{if(live.current&&serial===generation.current)setLoading(false);}}
 useEffect(()=>{live.current=true;void refresh();return()=>{live.current=false;generation.current++;callbacks.current.onDirtyChange?.(false);};},[headquartersId,eventId]);
 useEffect(()=>{callbacks.current.onDirtyChange?.(dirty);if(!dirty)return;const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty]);
 useEffect(()=>{callbacks.current.onBusyChange?.(busy);return()=>callbacks.current.onBusyChange?.(false);},[busy]);
 const changed=()=>{setDirty(true);setSaved(false);};
 async function save(){if(!view?.canRecord||flight.current||loading||!view.assignmentRequestId||view.destinationRevision===null)return;
  if(!keys.length||keys.some(key=>!remaining(view).some(p=>p.key===key)))return setError('未発送の参加者を選び直してください。');
  const stamp=new Date(`${shippedAt}+09:00`);if(!Number.isFinite(stamp.getTime()))return setError('発送日時を入力してください。');
  const input={assignmentRequestId:view.assignmentRequestId,destinationRevision:view.destinationRevision,rosterToken:view.rosterToken,participantKeys:[...keys].sort(),shippedAt:stamp.toISOString(),trackingNumber:tracking};
  const signature=JSON.stringify({headquartersId,eventId,revision:view.revision,input});if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};
  flight.current=true;setBusy(true);setError('');setSaved(false);
  try{const next=await recordEventKitShipping(headquartersId,eventId,view.revision,request.current.id,input);if(!live.current)return;setView(next);setKeys(remaining(next).map(p=>p.key));setDirty(false);setSaved(true);request.current=null;callbacks.current.onChange?.(next);callbacks.current.onSaved?.();}catch(cause){if(live.current)setError(cause instanceof Error?cause.message:'発送記録を保存できませんでした。入力内容は残っています。');}finally{flight.current=false;if(live.current)setBusy(false);}
 }
 return <div className={styles.section}>
  {loading?<p role="status" className={styles.help}>発送情報を読み込み中…</p>:null}{error?<p role="alert" className={styles.error}>{error}</p>:null}
  {view?<><div className={`${styles.notice} ${styles.green}`}><b>{view.applicable?view.remainingCount===0&&view.roster.length?'担当講師への発送：完了':`担当講師への発送：未発送 ${view.remainingCount}名分`:'担当講師の承諾を確認してください'}</b><p>{view.kitName??'キット'}</p>{view.address?<p style={{whiteSpace:'pre-wrap'}}>指定済みの発送先：{view.address}</p>:view.applicable?<p>担当講師による発送先の指定を待っています。</p>:null}</div>
   {view.canRecord?<fieldset className={styles.shippingForm} disabled={busy||loading}><legend>発送を記録</legend><p className={styles.help}>実際に発送したキットの対象者と発送日時を記録します。</p><div className={styles.shippingTargets}>{view.roster.map(person=>{const sent=!remaining(view).some(p=>p.key===person.key);return <label key={person.key}><input type="checkbox" disabled={sent} checked={keys.includes(person.key)} onChange={event=>{setKeys(current=>event.target.checked?[...current,person.key]:current.filter(key=>key!==person.key));changed();}}/>{person.name}{sent?'（発送記録済み）':''}</label>;})}</div>
    <button className={styles.btn} type="button" onClick={()=>{setKeys(remaining(view).map(p=>p.key));changed();}}>未発送の参加者を選び直す</button>
    <label>発送日時<input aria-label="キット発送日時" type="datetime-local" step="any" value={shippedAt} onChange={event=>{setShippedAt(event.target.value);changed();}}/></label><label>追跡番号（任意）<input aria-label="キット追跡番号" value={tracking} maxLength={200} onChange={event=>{setTracking(event.target.value);changed();}}/></label>
    <button className={`${styles.btn} ${styles.primary}`} type="button" disabled={!keys.length} onClick={()=>void save()}>{busy?'保存中…':'発送を記録する'}</button>
   </fieldset>:null}
   {dirty?<button className={styles.btn} disabled={busy||loading} onClick={()=>{if(window.confirm('保存していない発送入力を取り消しますか？')){setKeys(remaining(view).map(p=>p.key));setTracking('');setShippedAt(localNow());setDirty(false);request.current=null;}}}>発送の入力を取り消す</button>:null}
   {view.shipments.length?<div className={styles.section}><h3>発送履歴</h3>{view.shipments.map(shipment=><div className={styles.paymentRow} key={shipment.id}><b>{shipment.currentRecipient?'現在の担当者への発送':'以前の担当者への発送'}：{shipment.quantity}名分</b><p>{time(shipment.shippedAt)} / {shipment.participants.map(p=>p.name).join('、')}</p>{shipment.currentRecipient?<><p style={{whiteSpace:'pre-wrap'}}>{shipment.address}</p>{shipment.trackingNumber?<p>追跡番号：{shipment.trackingNumber}</p>:null}</>:<p className={styles.help}>担当者が変わったため、以前の発送先と追跡番号は表示しません。</p>}</div>)}</div>:<p className={styles.help}>発送記録はまだありません。</p>}</>:null}
  <div className={styles.actions}><button className={styles.btn} disabled={busy||loading} onClick={()=>void refresh()}>入力を残して発送情報を再確認</button></div>{saved?<p role="status" className={styles.saved}>発送を記録しました。</p>:null}
 </div>;
}
