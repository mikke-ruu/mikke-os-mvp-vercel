"use client";
import {use,useEffect,useState} from 'react';
import Link from 'next/link';
import {AuthGate} from '@/components/AuthGate';
import {instructorEmailInvitation,type InstructorInvitation} from '@/lib/academy/roster-local';
import styles from '@/components/academy/academy-roster.module.css';
function Invitation({token}:{token:string}){
 const [item,setItem]=useState<InstructorInvitation|null>(null),[error,setError]=useState(''),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;instructorEmailInvitation(token).then(value=>{if(active)setItem(value);}).catch(()=>{if(active)setError('この案内を開けません。案内が届いたメールアドレスでログインし、メール確認を済ませてください。有効期限が切れた場合は本部に再発行を依頼してください。');});return()=>{active=false;};},[token]);
 async function accept(){if(!checked||busy)return;setBusy(true);setError('');try{setItem(await instructorEmailInvitation(token,true));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <main className={styles.root} style={{padding:24}}><h1>講師登録の本人確認</h1>{error&&<p role="alert">{error}</p>}{!item&&!error?<p>案内を確認しています…</p>:item&&<section className={styles.card}><h2>{item.headquartersName}</h2><p>氏名：{item.name}</p><p>講師番号：{item.number}</p>{item.confirmed?<><p role="status">本人確認が完了しました。マイページで登録状況を確認できます。</p><Link href="/academy/portal" referrerPolicy="no-referrer">マイページで確認する</Link></>:<><p>この講師登録をご自身のmikkeアカウントと連携します。心当たりがない場合は承諾せず、本部に確認してください。</p><label style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" style={{width:20,flexShrink:0}} checked={checked} onChange={e=>setChecked(e.target.checked)}/>自分の氏名・講師番号であることを確認しました</label><button className={styles.primary} disabled={!checked||busy} onClick={()=>void accept()}>確認して連携する</button><p>連携後も、利用できる内容は本部の登録状況や活動設定によって異なります。</p></>}</section>}</main>;
}
export default function Page({params}:{params:Promise<{token:string}>}){const {token}=use(params);return <AuthGate><Invitation key={token} token={token}/></AuthGate>;}
