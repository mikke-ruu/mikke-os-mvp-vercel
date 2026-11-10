'use client';
import {useEffect,useState} from 'react';
import {ApplicationMailContent} from './ApplicationMailContent';
import {supabase} from '@/lib/supabase/client';
import {assertAcademyWritable} from '@/lib/academy/preview';
import {applicationDate} from './HeadquartersApplications';
import styles from './applications-operation.module.css';
type Mail={id?:string;state:string;sentAt?:string|null;contactedAt?:string|null;revision?:number};
type Status={applicationId:string;paidAt:string|null;receipt:Mail;participation:Mail;canManage:boolean};
const label=(state:string)=>({queued:'送信待ち',sending:'送信処理中',sent:'送信済み',failed:'送信できませんでした',unknown:'送信結果の確認が必要です',cancelled:'送信を取り消しました',unrecorded:'送信記録がありません'} as Record<string,string>)[state]??'送信状況を確認してください';
export function ApplicationMailStatus({hq,applicationId,refreshKey,planTitle}:{hq:string;applicationId:string;refreshKey?:unknown;planTitle?:string}){
 const [data,setData]=useState<Status|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setData(null);setError('');supabase.rpc('academy2_hq_mail_status',{p_hq:hq,p_applications:[applicationId]}).then(({data,error})=>{if(!live)return;if(error)setError('メールの送信状況を確認できませんでした。');else setData(data?.[0]??null);});return()=>{live=false;};},[hq,applicationId,refreshKey,retry]);
 async function followup(action:'retry'|'contacted'){
  if(!data?.participation.id||busy)return;setBusy(true);setError('');
  try{assertAcademyWritable();}catch{setError('確認用の画面では送信記録を変更できません。');setBusy(false);return;}
  const {error}=await supabase.rpc('academy2_hq_mail_followup',{p_hq:hq,p_job:data.participation.id,p_expected:data.participation.revision,p_action:action});
  if(error)setError('変更を確認できませんでした。最新の状態を読み込んでください。');else setRetry(v=>v+1);setBusy(false);
 }
 return <section className={styles.detailCard} aria-label="メールの送信状況"><h2>メールの送信状況</h2><p className={styles.meta}>{['http://127.0.0.1:57982','http://127.0.0.1:57983'].includes(process.env.NEXT_PUBLIC_SUPABASE_URL??'')?'ローカル確認用です。送信済みは確認用受信箱への保存を示し、外部へ実メールは送信しません。':'申込受付と入金後の案内メールの送信状況です。'}</p>{planTitle&&<p>{planTitle}</p>}{error?<p role="alert">{error}</p>:!data?<p role="status">送信記録を確認しています…</p>:<>
  {data.paidAt&&<p>入金確認：{applicationDate(data.paidAt)}</p>}
  <p>申込受付メール：{label(data.receipt.state)}{data.receipt.sentAt?'　'+applicationDate(data.receipt.sentAt):''}</p>
  <p>入金確認・参加案内：{label(data.participation.state)}{data.participation.sentAt?'　'+applicationDate(data.participation.sentAt):''}</p>
  {data.participation.state==='queued'&&<p className={styles.meta}>送信結果は、この画面で確認できます。</p>}
  {['failed','unknown'].includes(data.participation.state)&&<><p>送信先を確認してください。送信結果が不明な場合は、重複送信を避けるため再送を止めています。</p>{data.participation.contactedAt?<p>別の方法で連絡済み：{applicationDate(data.participation.contactedAt)}</p>:data.canManage&&<div className={styles.actions}>{data.participation.state==='failed'&&<button type="button" className={styles.button} disabled={busy} onClick={()=>void followup('retry')}>再送を予約する</button>}<button type="button" className={styles.button} disabled={busy} onClick={()=>{if(window.confirm('別の方法で連絡したことを記録しますか？'))void followup('contacted');}}>別の方法で連絡済みにする</button></div>}</>}
  <p className={styles.meta}>送信済みは、相手が読んだことを示すものではありません。</p>
 </>}<ApplicationMailContent hq={hq} applicationId={applicationId}/><button type="button" className={styles.textButton} disabled={busy} onClick={()=>setRetry(v=>v+1)}>送信状況を再確認</button></section>;
}
