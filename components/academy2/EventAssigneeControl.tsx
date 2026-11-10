'use client';
import {useEffect,useRef,useState} from 'react';
import {getEventAssigneeCandidates,getEventAssignees,saveEventAssignee,type EventAssigneeView,type EventAssigneeKind} from '@/lib/academy2/event-assignees';
import styles from './event-form.module.css';
import {EventCertifiedInstructor} from './EventCertifiedInstructor';
import {assignmentCandidates} from '@/lib/academy2/instructor-assignments';
export function useEventAssignee(headquartersId:string|undefined,eventId:string|undefined){
 const [view,setView]=useState<EventAssigneeView|null>(null),[error,setError]=useState('');
 const [kind,setKind]=useState<EventAssigneeKind>('headquarters'),[id,setId]=useState(''),[dirty,setDirty]=useState(false);
 const selectionChanged=useRef(false);
 const command=useRef<{body:string;id:string}|null>(null);
 useEffect(()=>{let current=true;setView(null);setError('');setDirty(false);selectionChanged.current=false;if(!headquartersId)return;
  (eventId?getEventAssignees(headquartersId,eventId):getEventAssigneeCandidates(headquartersId)).then(result=>{if(current){setView(result);if(!selectionChanged.current){setKind(result.assignment?.kind??'headquarters');setId(result.assignment?.assigneeId??'');}}}).catch(cause=>{if(current)setError(cause instanceof Error?cause.message:'担当者を確認できませんでした。');});return()=>{current=false;};
 },[headquartersId,eventId]);
 const chooseKind=(value:EventAssigneeKind)=>{selectionChanged.current=true;setKind(value);setId('');setDirty(true);};
 const chooseId=(value:string)=>{selectionChanged.current=true;setId(value);setDirty(true);};
 const save=async(coreSaved=false)=>{if(!dirty)return;if(kind==='headquarters'&&!id&&!view?.assignment){setDirty(false);return;}if(!headquartersId||!eventId||!view||!id)throw new Error((coreSaved?'開催内容は保存しました。':'')+'担当者を選択して、もう一度保存してください。');
  const body=JSON.stringify({kind,id,revision:view.assignment?.revision??0});if(command.current?.body!==body)command.current={body,id:crypto.randomUUID()};
  try { const result=await saveEventAssignee(headquartersId,eventId,view.assignment?.revision??0,command.current.id,kind,id);setView(result);setDirty(false);setError('');command.current=null; } catch(cause) { throw new Error((coreSaved?'開催内容は保存しました。':'')+'担当者の保存を確認できませんでした。'+(cause instanceof Error?cause.message:'')); }
 };
 return {view,error,kind,id,dirty,chooseKind,chooseId,save,eventId,headquartersId};
}
export function EventAssigneeControl({state,locked}:{state:ReturnType<typeof useEventAssignee>;locked:boolean}){
 const [certified,setCertified]=useState(false);
 useEffect(()=>{let current=true;if(state.headquartersId&&state.eventId)void assignmentCandidates(state.headquartersId,state.eventId).then(v=>{if(current&&v.requests.some(r=>['requested','consulting','accepted'].includes(r.status)))setCertified(true);}).catch(()=>{});return()=>{current=false;};},[state.headquartersId,state.eventId]);
 const options=state.kind==='headquarters'?state.view?.staff:state.view?.external;
 return <div className={styles.section}><h3>担当者</h3><div className={styles.help}>担当者を指定しない場合は、本部が担当します。</div>
 <div className={styles['assignee-type']}>{([['headquarters','本部','本部のメンバーが担当します。'],['external','外部講師','招待して参加した外部講師を選びます。']] as const).map(([kind,label,help])=><button type="button" disabled={locked||!state.view} aria-pressed={state.kind===kind} key={kind} className={`${styles['assignee-choice']} ${!certified&&state.kind===kind?styles.on:''}`} onClick={()=>{setCertified(false);state.chooseKind(kind);}}><strong>{label}</strong><p>{help}</p></button>)}{certified&&<button type="button" disabled={locked||!state.eventId} onClick={()=>setCertified(true)} className={`${styles['assignee-choice']} ${certified?styles.on:''}`}><strong>認定講師の既存依頼</strong><p>保存済みの依頼内容を確認します。</p></button>}</div>
 {certified&&state.eventId&&state.headquartersId?<EventCertifiedInstructor headquartersId={state.headquartersId} eventId={state.eventId} locked={locked}/>:state.error?<p role="alert" className={styles.help}>{state.error}</p>:!state.view?<p role="status" className={styles.help}>担当者を読み込み中…</p>:<><div className={styles.field} style={{marginTop:10}}><label>{state.kind==='headquarters'?'担当する人':'外部講師'}<select aria-label={state.kind==='headquarters'?'担当する人':'外部講師'} disabled={locked} value={state.id} onChange={e=>state.chooseId(e.target.value)}><option value="" disabled={!!state.view.assignment}>{state.kind==='headquarters'?'本部で担当（担当者を指定しない）':'外部講師を選択してください'}</option>{options?.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>{!options?.length?<p className={styles.help}>{state.kind==='external'?'本部設定の「役割・権限」で外部講師を招待すると、承諾後にここへ表示されます。':'登録済みの担当者はありません。'}</p>:null}{state.dirty?<p role="status" className={styles.help}>担当者に未保存の変更があります。</p>:null}</>}
 </div>;
}
