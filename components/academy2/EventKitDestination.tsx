'use client';
import {useEffect,useRef,useState} from 'react';
import {getEventKitDestination,saveEventKitDestination,type EventKitDestinationView} from '@/lib/academy2/event-kit-destination';
import {assignmentRequests,type AssignmentRequest} from '@/lib/academy2/instructor-assignments';
import styles from './event-form.module.css';
export function EventKitDestination({requestId}:{requestId:string}){
 const [data,setData]=useState<EventKitDestinationView|null>(null),[address,setAddress]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0),[saved,setSaved]=useState(false);const command=useRef<{body:string;id:string}|null>(null);
 useEffect(()=>{let active=true;setData(null);setError('');getEventKitDestination(requestId).then(value=>{if(active){setData(value);setAddress(value.selectedAddressId??'');}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[requestId,retry]);
 async function save(){if(!data?.canSelect||!address||busy)return;setBusy(true);setError('');const body=JSON.stringify({requestId,address,revision:data.revision});if(command.current?.body!==body)command.current={body,id:crypto.randomUUID()};try{await saveEventKitDestination(requestId,address,data.revision,command.current.id);const next=await getEventKitDestination(requestId);setData(next);setAddress(next.selectedAddressId??'');command.current=null;setSaved(true);}catch(e){setError(e instanceof Error?e.message:'発送先を保存できませんでした。');}finally{setBusy(false);}}
 if(data&&!data.applicable)return null;
 return <div className={styles['kit-destination']}><strong>本部から担当講師へのキット発送</strong>{error?<p role="alert">{error}<button type="button" disabled={busy} onClick={()=>setRetry(v=>v+1)}>再読み込み</button></p>:!data?<p role="status">発送先を確認しています…</p>:<>{data.selectedAddress?<p style={{whiteSpace:'pre-wrap'}}>指定済みの発送先：{data.selectedAddress}</p>:<p>担当講師による発送先の指定を待っています。</p>}{data.canSelect?<><label className={styles.field}>キットの発送先<select value={address} disabled={busy} onChange={e=>{setAddress(e.target.value);setSaved(false);}}><option value="">登録住所から選んでください</option>{data.options.map(item=><option key={item.id} value={item.id}>{item.label}：{item.address}</option>)}</select></label><p>選んだ住所を、この開催のキット発送先として本部に共有します。</p><button type="button" className={styles.btn} disabled={busy||!address} onClick={()=>void save()}>{busy?'保存中…':'発送先を指定して保存'}</button>{!data.options.length?<p>指定できる登録住所がありません。講師の住所登録を確認してください。</p>:null}</>:null}{saved?<p role="status">発送先を保存しました。</p>:null}</>}</div>;
}
export function EventKitDestinationsForEvent({headquartersId,eventId}:{headquartersId:string;eventId:string}){
 const [requests,setRequests]=useState<AssignmentRequest[]|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setError('');assignmentRequests(headquartersId,eventId).then(rows=>{if(active)setRequests(rows.filter(r=>r.status==='accepted'));}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[headquartersId,eventId,retry]);
 return <div>{error?<p role="alert">{error}</p>:requests===null?<p role="status">保存済みの担当情報を確認しています…</p>:requests.map(request=><EventKitDestination key={request.id} requestId={request.id}/>)}<button type="button" className={styles.btn} onClick={()=>setRetry(v=>v+1)}>担当・発送先を再確認</button></div>;
}
