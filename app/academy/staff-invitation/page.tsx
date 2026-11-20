'use client';
import {useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {AuthGate} from '@/components/AuthGate';
import {supabase} from '@/lib/supabase/client';
import {respondAcademy2StaffInvitation} from '@/lib/academy2/staff-invitations';
import {staffRoleNames} from '@/components/academy2/HeadquartersStaffPanel';
import styles from '@/components/academy2/headquarters-settings.module.css';
type Invitation={id:string;headquartersId:string;name:string;role:string;status:string;expiresAt:string;expired:boolean};
function Content(){const id=useSearchParams().get('id'),[data,setData]=useState<Invitation|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;if(!id||!/^[0-9a-f-]{36}$/i.test(id)){setError('招待が見つかりませんでした。');return;}supabase.rpc('academy2_staff_invitation',{p_invitation_id:id}).then(({data,error})=>{if(!live)return;if(error)setError('招待を確認できませんでした。招待されたメールアドレスでログインしているか、メールアドレスの確認が済んでいるかをご確認ください。');else setData(data as Invitation);});return()=>{live=false;};},[id]);
 async function respond(response:'accepted'|'declined'){if(!data||busy)return;setBusy(true);setError('');try{const result=await respondAcademy2StaffInvitation(data.id,response);setData({...data,status:result.status});}catch{setError('招待への回答を保存できませんでした。有効期限や参加状況をご確認ください。');}finally{setBusy(false);}}
 return <main className={styles.wrap} style={{maxWidth:620,margin:'60px auto',padding:20}}><section className={styles.card}><h1 style={{fontSize:23}}>Academyへのご招待</h1>{error&&<p role="alert" className={styles.error}>{error}</p>}{!data&&!error&&<p role="status">招待を確認しています…</p>}{data&&<><h2>{data.name}</h2><p>役割：{staffRoleNames[data.role]??data.role}</p><p className={styles.help}>有効期限：{new Date(data.expiresAt).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo'})}</p>{data.status==='accepted'?<><p role="status">参加を承諾しました。</p><a className={`${styles.btn} ${styles.orange}`} style={{display:'inline-flex',marginTop:12}} href={`/academy/h/${data.headquartersId}/manage`}>Academyを開く</a></>:data.status==='declined'?<p role="status">招待を辞退しました。</p>:data.expired?<p>この招待の有効期限が過ぎています。招待元にご連絡ください。</p>:data.status==='pending'?<><p>内容を確認して参加を承諾すると、利用できるようになります。</p><div className={styles.actions}><button className={`${styles.btn} ${styles.orange}`} disabled={busy} onClick={()=>void respond('accepted')}>参加を承諾する</button><button className={styles.btn} disabled={busy} onClick={()=>void respond('declined')}>辞退する</button></div></>:<p>この招待は取り消されています。</p>}</>}</section></main>;
}
export default function Page(){return <AuthGate><Content/></AuthGate>;}
