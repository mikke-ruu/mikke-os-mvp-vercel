'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useAuth} from '@/components/AuthGate';
import {supabase} from '@/lib/supabase/client';
import {invitationRequest,safeInvitationDestination,type InvitationApp,type InvitationView} from '@/lib/mikkeos/invitations';
const button='min-h-11 rounded-xl border border-[var(--mikke-line)] px-4 py-3 font-semibold disabled:opacity-50';
export function InvitationLanding({app,id}:{app:InvitationApp;id:string}){
 const {user}=useAuth();const [view,setView]=useState<InvitationView|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);const flight=useRef(false);
 useEffect(()=>{let live=true;setView(null);setError('');invitationRequest<InvitationView>(app,id,'inspect').then(value=>{if(live)setView(value);}).catch(cause=>{if(live)setError(cause.message);});return()=>{live=false;};},[app,id,user.id,retry]);
 async function accept(){if(flight.current||view?.state!=='pending')return;flight.current=true;setBusy(true);setError('');try{const result=await invitationRequest<InvitationView>(app,id,'accept');setView(result);}catch(cause){setView(null);setError(cause instanceof Error?cause.message:'参加結果を確認できませんでした。');}finally{flight.current=false;setBusy(false);}}
 async function switchAccount(){if(busy)return;setBusy(true);const {error}=await supabase.auth.signOut({scope:'local'});if(error){setError('アカウントを切り替えられませんでした。');setBusy(false);return;}window.location.assign('/login?next='+encodeURIComponent(`/invitations/${app}/${id}`));}
 return <InvitationCard app={app} view={view} error={error} busy={busy} onRetry={()=>setRetry(value=>value+1)} onAccept={()=>void accept()} onSwitchAccount={()=>void switchAccount()}/>;
}
export function InvitationCard({app,view,error,busy,onRetry,onAccept,onSwitchAccount}:{app:InvitationApp;view:InvitationView|null;error:string;busy:boolean;onRetry:()=>void;onAccept:()=>void;onSwitchAccount:()=>void}){
 const destination=safeInvitationDestination(app,view?.destination);
 return <main className="mx-auto max-w-xl px-4 py-10 text-[var(--mikke-text)]"><p className="text-sm font-semibold tracking-widest text-[var(--mikke-accent)]">mikkeOS</p><section className="mt-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-6"><h1 className="text-2xl font-semibold">{app==='academy'?'Academy':'Team Works'}へのご招待</h1>
  {!view&&!error&&<p role="status" className="mt-5">招待内容を確認しています…</p>}
  {error&&<div role="alert" className="mt-5"><p>{error}</p><button disabled={busy} className={button+' mt-4'} onClick={onRetry}>状態を再確認</button></div>}
  {view?.state==='mismatch'&&<><p className="mt-5 leading-7">招待されたメールアドレスと、ログイン中のアカウントが違います。招待メールを受け取ったアドレスでログインしてください。</p><button disabled={busy} className={button+' mt-4'} onClick={onSwitchAccount}>別のアカウントでログイン</button></>}
  {view?.state==='email_unverified'&&<><p className="mt-5 leading-7">メールアドレスの確認を完了してから、この画面で再確認してください。</p><button disabled={busy} className={button+' mt-4'} onClick={onRetry}>確認を終えたので再確認</button></>}
  {view?.state==='expired'&&<p className="mt-5 leading-7">招待の有効期限が切れています。招待元に新しい招待を依頼してください。</p>}
  {view?.state==='unavailable'&&<p className="mt-5 leading-7">この招待は現在利用できません。招待元にご確認ください。</p>}
  {(view?.state==='pending'||view?.state==='accepted')&&<><h2 className="mt-6 text-xl font-semibold">{view.title}</h2><dl className="mt-4 space-y-3 rounded-xl bg-[var(--mikke-bg)] p-4"><div><dt className="text-sm">参加する役割</dt><dd className="mt-1 font-semibold">{view.roleLabel}</dd></div>{view.sender&&<div><dt className="text-sm">招待元</dt><dd>{view.sender}</dd></div>}</dl>
  {view.state==='pending'?<><p className="mt-4 leading-7">内容を確認し、参加する場合は下のボタンを押してください。</p><button disabled={busy} className={button+' mt-5 w-full bg-[var(--mikke-accent)] text-white'} onClick={onAccept}>{busy?'参加結果を確認中…':'承諾して参加する'}</button></>:<><p role="status" className="mt-5">参加を確認しました。</p>{destination?<Link href={destination} className={button+' mt-5 inline-block bg-[var(--mikke-accent)] text-white'}>{app==='academy'?'管理画面を開く':'参加先を開く'}</Link>:<p role="alert">参加先を確認できませんでした。招待元にご確認ください。</p>}</>}
  </>}
 </section></main>;
}
