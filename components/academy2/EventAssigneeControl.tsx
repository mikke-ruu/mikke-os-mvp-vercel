'use client';
import {useEffect,useRef,useState} from 'react';
import {getEventAssignees,saveEventAssignee,type EventAssigneeView,type EventAssigneeKind} from '@/lib/academy2/event-assignees';
import styles from './event-form.module.css';
import {EventCertifiedInstructor} from './EventCertifiedInstructor';
import {assignmentCandidates} from '@/lib/academy2/instructor-assignments';
export function useEventAssignee(headquartersId:string|undefined,eventId:string|undefined){
 const [view,setView]=useState<EventAssigneeView|null>(null),[error,setError]=useState('');
 const [kind,setKind]=useState<EventAssigneeKind>('headquarters'),[id,setId]=useState(''),[dirty,setDirty]=useState(false);
 const command=useRef<{body:string;id:string}|null>(null);
 useEffect(()=>{let current=true;setView(null);setError('');setDirty(false);if(!headquartersId||!eventId)return;
  getEventAssignees(headquartersId,eventId).then(result=>{if(current){setView(result);setKind(result.assignment?.kind??'headquarters');setId(result.assignment?.assigneeId??'');}}).catch(cause=>{if(current)setError(cause instanceof Error?cause.message:'担当者を確認できませんでした。');});return()=>{current=false;};
 },[headquartersId,eventId]);
 const chooseKind=(value:EventAssigneeKind)=>{setKind(value);setId('');setDirty(true);};
 const chooseId=(value:string)=>{setId(value);setDirty(true);};
 const save=async()=>{if(!dirty)return;if(!headquartersId||!eventId||!view||!id)throw new Error('開催内容は保存しました。担当者を選択して、もう一度保存してください。');
  const body=JSON.stringify({kind,id,revision:view.assignment?.revision??0});if(command.current?.body!==body)command.current={body,id:crypto.randomUUID()};
  try { const result=await saveEventAssignee(headquartersId,eventId,view.assignment?.revision??0,command.current.id,kind,id);setView(result);setDirty(false);setError('');command.current=null; } catch(cause) { throw new Error('開催内容は保存しました。担当者の保存は確認できていません。'+(cause instanceof Error?cause.message:'')); }
 };
 return {view,error,kind,id,dirty,chooseKind,chooseId,save,eventId,headquartersId};
}
export function EventAssigneeControl({state,locked}:{state:ReturnType<typeof useEventAssignee>;locked:boolean}){
 const [certified,setCertified]=useState(false);
 useEffect(()=>{let current=true;if(state.headquartersId&&state.eventId)void assignmentCandidates(state.headquartersId,state.eventId).then(v=>{if(current&&v.requests.some(r=>['requested','consulting','accepted'].includes(r.status)))setCertified(true);}).catch(()=>{});return()=>{current=false;};},[state.headquartersId,state.eventId]);
 const options=state.kind==='headquarters'?state.view?.staff:state.view?.external;
 return <div className={styles.section}><h3>担当者</h3><div className={styles.help}>本部開催、外部講師、認定講師から選びます。認定講師は、この販売プランを担当できる人だけ表示します。</div>
 <div className={styles['assignee-type']}>{([['headquarters','本部','本部スタッフが担当します。'],['external','外部講師','通常の外部講師へ依頼します。']] as const).map(([kind,label,help])=><button type="button" disabled={locked||!state.view} aria-pressed={state.kind===kind} key={kind} className={`${styles['assignee-choice']} ${!certified&&state.kind===kind?styles.on:''}`} onClick={()=>{setCertified(false);state.chooseKind(kind);}}><strong>{label}</strong><p>{help}</p></button>)}<button type="button" disabled={locked||!state.eventId} onClick={()=>setCertified(true)} className={`${styles['assignee-choice']} ${certified?styles.on:''}`}><strong>認定講師</strong><p>この販売プランを担当できる認定講師へ依頼します。</p></button></div>
 {certified&&state.eventId&&state.headquartersId?<EventCertifiedInstructor headquartersId={state.headquartersId} eventId={state.eventId} locked={locked}/>:!state.eventId?<p className={styles.help}>開催を保存すると担当者を選択できます。</p>:state.error?<p role="alert" className={styles.help}>{state.error}</p>:!state.view?<p role="status" className={styles.help}>担当者を読み込み中…</p>:<><div className={styles.field} style={{marginTop:10}}><label>{state.kind==='headquarters'?'担当する人':'外部講師'}<select disabled={locked} value={state.id} onChange={e=>state.chooseId(e.target.value)}><option value="">選択してください</option>{options?.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>{!options?.length?<p className={styles.help}>登録済みの担当者はありません。</p>:null}<p className={styles.help}>{state.view.certifiedHold}</p>{state.dirty?<p role="status" className={styles.help}>担当者に未保存の変更があります。</p>:null}</>}
 </div>;
}
