'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {assignmentCandidates,requestAssignment,assignmentLabels,type AssignmentCandidates} from '@/lib/academy2/instructor-assignments';
import {getInstructorRequestFee,saveInstructorRequestFee} from '@/lib/academy2/event-assignees';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import styles from './event-form.module.css';
export function EventCertifiedInstructor({headquartersId,eventId,locked}:{headquartersId:string;eventId:string;locked:boolean}){
 const [data,setData]=useState<AssignmentCandidates|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[amount,setAmount]=useState(''),[note,setNote]=useState(''),[retry,setRetry]=useState(0);
 const command=useRef<{body:string;id:string}|null>(null);
 useEffect(()=>{let active=true;setError('');assignmentCandidates(headquartersId,eventId).then(v=>{if(active)setData(v);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[headquartersId,eventId,retry]);
 async function send(id:string){if(busy||locked||amount===''||!Number.isSafeInteger(Number(amount))||Number(amount)<0)return;setBusy(true);setError('');const body=JSON.stringify({id,amount,note});if(command.current?.body!==body)command.current={body,id:crypto.randomUUID()};try{setData(await requestAssignment(headquartersId,eventId,id,command.current.id,Number(amount),note));command.current=null;}catch(e){setError(e instanceof Error?e.message:'担当依頼を保存できませんでした。');}finally{setBusy(false);}}
 async function fee(id:string){if(busy||locked||amount===''||!Number.isSafeInteger(Number(amount))||Number(amount)<0)return;setBusy(true);setError('');try{const current=await getInstructorRequestFee(headquartersId,id);await saveInstructorRequestFee(headquartersId,id,current.revision,Number(amount));setData(await assignmentCandidates(headquartersId,eventId));}catch(e){setError(e instanceof Error?e.message:'担当料を保存できませんでした。');}finally{setBusy(false);}}
 return <div style={{marginTop:10}}><p className={styles.help}>対象の講師ライセンス・契約・活動状態・カード決済登録を確認し、担当可能な認定講師だけ表示します。</p>
 {error?<p role="alert" className={styles.help}>{error}<button type="button" onClick={()=>setRetry(v=>v+1)}>再読み込み</button></p>:null}
 {!data?<p role="status" className={styles.help}>担当可能な講師を確認中…</p>:<>
 <div className={styles.field}><label>講座担当料（円）<input type="number" min="0" step="1" value={amount} disabled={locked||busy} onChange={e=>setAmount(e.target.value)}/></label></div>
 <div className={styles.field}><label>依頼メモ<textarea maxLength={2000} value={note} disabled={locked||busy} onChange={e=>setNote(e.target.value)}/></label></div>
 <div className={styles['instructor-list']}>{data.candidates.map(i=><div className={styles['instructor-card']} key={i.id}><div><strong><Link href={toAcademyContextHref(`/academy/instructors/${i.id}`,headquartersId,'manage')}>{i.name||'講師情報を確認'}</Link></strong><p>販売プラン担当可・本部依頼受付中</p></div><button type="button" disabled={locked||busy||amount===''||data.requests.some(r=>['requested','consulting','accepted'].includes(r.status))} onClick={()=>void send(i.id)}>担当を依頼</button></div>)}</div>
 {!data.candidates.length?<p className={styles.help}>現在、担当条件を満たす認定講師はいません。</p>:null}
 <div className={styles['request-box']}>講師は「承諾・相談・辞退」で回答します。申込者との日程調整は本部が行います。</div>
 {data.requests.map(r=><div key={r.id} className={styles['request-box']}><strong>{r.instructorName}：{assignmentLabels[r.status]}</strong>{r.feeYen!==null?<p>講座担当料 ¥{r.feeYen.toLocaleString('ja-JP')}</p>:null}{r.responseNote?<p>回答：{r.responseNote}</p>:null}{r.feeEditable?<button type="button" disabled={locked||busy||amount===''} onClick={()=>void fee(r.id)}>入力した担当料へ変更</button>:null}</div>)}
 </>}
 </div>;
}
