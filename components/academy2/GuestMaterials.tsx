'use client';
import {useEffect,useRef,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {AuthGate,useAuth} from '@/components/AuthGate';
import {claimMyGuestApplication,listMyGuestMaterials,guestMaterialTokenKey,type GuestMaterialApplication} from '@/lib/academy2/guest-materials';
import {LearnerMaterials} from './LearnerMaterials';
import {supabase} from '@/lib/supabase/client';

const descriptions={available:'教材をご覧いただけます。',awaiting_payment:'本部の入金確認後に教材をご覧いただけます。',awaiting_completion:'本部が受講完了を確認すると教材をご覧いただけます。',expired:'教材の閲覧期間が終了しました。',unavailable:'現在は教材を表示できません。主催者へお問い合わせください。'};
const forgetToken=(id:string)=>{try{sessionStorage.removeItem(guestMaterialTokenKey(id));}catch{/* Binding already saved; storage cleanup must not undo success. */}};
const button='min-h-11 rounded-xl border border-[var(--mikke-line)] px-4 py-3 text-sm';
export function GuestMaterialEntry(){
 const [ready,setReady]=useState(false),[entryError,setEntryError]=useState('');
 useEffect(()=>{
  const id=new URLSearchParams(window.location.search).get('application'),token=window.location.hash.match(/^#receive=([a-f0-9]{64})$/)?.[1];
  try{if(id&&/^[a-f0-9-]{36}$/i.test(id)&&token)sessionStorage.setItem(guestMaterialTokenKey(id),token);}
  catch{setEntryError('教材のリンクを保持できませんでした。ブラウザの保存機能を有効にして、メールのリンクを開き直してください。');}
  finally{if(window.location.hash)window.history.replaceState(null,'',window.location.pathname+window.location.search);setReady(true);}
 },[]);
 if(entryError)return <main className="mx-auto max-w-3xl p-6" role="alert">{entryError}</main>;
 if(!ready)return <p role="status">教材のリンクを確認しています…</p>;
 return <AuthGate><GuestMaterials/></AuthGate>;
}
export function GuestMaterials(){const {user}=useAuth(),params=useSearchParams();return <GuestMaterialsBody key={user.id+':'+(params.get('application')??'')}/>;}
function GuestMaterialsBody(){
 const {user}=useAuth(),params=useSearchParams(),requested=params.get('application');
 const invalid=!!requested&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requested);
 const [rows,setRows]=useState<GuestMaterialApplication[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState<string|null>(null),[retry,setRetry]=useState(0),[more,setMore]=useState(false);
 const mounted=useRef(true),flight=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{let live=true;setRows(null);setSelected(null);setError('');if(invalid)return;listMyGuestMaterials(requested).then(value=>{if(live){setRows(value);setMore(!requested&&value.length===25);}}).catch(cause=>{if(live)setError(cause instanceof Error?cause.message:'教材を確認できませんでした。');});return()=>{live=false;};},[requested,invalid,retry]);
 async function claim(row:GuestMaterialApplication){if(flight.current)return;flight.current=true;setBusy(true);setError('');try{const result=await claimMyGuestApplication(row.applicationId);if(!mounted.current)return;const saved=result.find(value=>value.applicationId===row.applicationId&&value.claimed);if(!saved)throw new Error('受け取りを確認できませんでした。もう一度一覧を開き直してください。');forgetToken(saved.applicationId);setRows(current=>current?.map(value=>value.applicationId===saved.applicationId?saved:value)??[saved]);if(saved.state==='available')setSelected(saved.applicationId);}catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:'受け取りを確認できませんでした。');}finally{flight.current=false;if(mounted.current)setBusy(false);}}
 async function loadMore(){if(flight.current||!rows?.length)return;flight.current=true;setBusy(true);setError('');try{const value=await listMyGuestMaterials(null,rows[rows.length-1]);if(mounted.current){setRows(current=>[...(current??[]),...value]);setMore(value.length===25);}}catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:'続きを読み込めませんでした。');}finally{flight.current=false;if(mounted.current)setBusy(false);}}
 return <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 text-[var(--mikke-ink)]"><header className="space-y-3"><p className="text-xs tracking-widest text-[var(--mikke-primary)]">ACADEMY</p><h1 className="text-2xl font-semibold">お申し込みの講座と教材</h1><p className="text-sm leading-7">ログインせずに申し込んだ講座の教材を、このアカウントで受け取れます。お申し込みと同じメールアドレスをご利用ください。</p><div className="flex flex-wrap gap-3">{requested&&<Link href="/academy/guest-materials" onClick={()=>forgetToken(requested)} className={button}>教材の一覧へ</Link>}<Link href="/academy/offering-applications/mine" className={button}>自分の申込へ</Link><button type="button" disabled={busy} className={button} onClick={()=>{setBusy(true);void supabase.auth.signOut({scope:'local'}).then(({error})=>{if(error){setError('ログインを切り替えられませんでした。もう一度お試しください。');setBusy(false);return;}window.location.assign('/login?next='+encodeURIComponent('/academy/guest-materials'+(requested?'?application='+encodeURIComponent(requested):'')));}).catch(()=>{setError('ログインを切り替えられませんでした。もう一度お試しください。');setBusy(false);});}}>ログインを切り替える</button></div></header>
 {invalid?<p role="alert">リンクを確認できませんでした。メールに記載したリンクから開き直してください。</p>:error?<div className="space-y-3 rounded-xl border p-4"><p role="alert">{error}</p><button className={button} disabled={busy} onClick={()=>setRetry(v=>v+1)}>もう一度確認する</button></div>:!rows?<p role="status">教材の受け取り状況を確認しています…</p>:selected?<section className="space-y-4"><button className={button} onClick={()=>setSelected(null)}>講座の一覧に戻る</button><LearnerMaterials key={selected} applicationId={selected} guest/></section>:<>
 {!rows.length&&<p className="rounded-xl border p-5 text-sm leading-7">このアカウントで受け取れる教材はありません。受付メールの「教材の受け取り」から開き、お申し込みと同じメールアドレスでログインしてください。</p>}
 {rows.map(row=><article key={row.applicationId} className="space-y-3 rounded-2xl border border-[var(--mikke-line)] p-5"><h2 className="text-lg font-semibold">{row.planName}</h2><p className="text-xs">申込日：{new Date(row.appliedAt).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo'})}</p><p className="text-sm leading-7">{descriptions[row.state]}</p>{!row.claimed?<><p className="text-sm leading-7">お申し込み内容を確認し、このアカウントで受け取ってください。</p><div className="flex flex-wrap gap-3"><button className={button+' bg-[var(--mikke-accent)] text-white'} disabled={busy} onClick={()=>void claim(row)}>このアカウントで受け取る</button><Link className={button} href="/academy/guest-materials" onClick={()=>forgetToken(row.applicationId)}>受け取りをやめる</Link></div></>:row.state==='available'?<button className={button+' bg-[var(--mikke-accent)] text-white'} disabled={busy} onClick={()=>setSelected(row.applicationId)}>教材を見る</button>:<p className="text-xs">このアカウントで受け取り済みです。</p>}</article>)}
 {more&&<button className={button} disabled={busy} onClick={()=>void loadMore()}>さらに読み込む</button>}
 </>}
 </main>;
}
