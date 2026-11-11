"use client";

import { useEffect, useRef, useState } from 'react';
import type { Academy2HeadquartersContext } from '@/lib/academy2/context';
import { getAcademy2ReceiptMailSettings, saveAcademy2ReceiptMailSettings, type Academy2ReceiptMailSettings } from '@/lib/academy2/receipt-mail-settings';
import { validateBody } from '@/lib/academy/offering-mail-content.mjs';
import styles from './headquarters-settings.module.css';
import {RECEIPT_V2_BODY,receiptV2} from '@/lib/academy2/receipt-v2.mjs';
import {getHeadquartersSettings} from '@/lib/academy2/headquarters-settings';
import { HeadquartersSettingsPanels,type SettingsPanelStatus } from './HeadquartersSettingsPanels';
import { AcademyGettingStarted } from './AcademyGettingStarted';
import {useAuth} from '@/components/AuthGate';
import {StaffInvitationMailPreview} from './StaffInvitationMailPreview';

const tabs = [{id:'本部情報',label:'基本情報',query:'basic'},{id:'支払',label:'お支払い',query:'payment'},{id:'規約・契約',label:'規約・契約',query:'terms'},{id:'通知メール',label:'メール設定',query:'mail'},{id:'お知らせ',label:'お知らせ',query:'notices'},{id:'Community',label:'Community連携',query:'community'},{id:'役割・権限',label:'役割・権限',query:'roles'},{id:'利用料金',label:'利用料金',query:'billing'}];
const variables = [{label:'お名前',value:'{{name}}'},{label:'講座名',value:'{{title}}'},{label:'金額',value:'{{price}}'}];

/** UI31 v0.1 layout. Only receipt body persistence is connected; this component never dispatches mail. */
export function Academy2HeadquartersSettings({headquarters}:{headquarters:Academy2HeadquartersContext}) {
 const {user}=useAuth();const [intro,setIntro]=useState(false);
 const canEdit = headquarters.role === 'administrator';
 const [tab,setTab]=useState('本部情報');
 const [safeReturn,setSafeReturn]=useState<string|null>(null);
 const [setupOpen,setSetupOpen]=useState(false),[settingsRefresh,setSettingsRefresh]=useState(0);
 const [panelStatus,setPanelStatus]=useState<SettingsPanelStatus|null>(null);
 function openSetup(){if(panelStatus?.dirty&&!window.confirm('保存していない入力があります。初期設定を開きますか？'))return;setIntro(false);setSetupOpen(true);}
 useEffect(()=>{const q=new URLSearchParams(window.location.search);if(q.get('onboarding')==='1'){setIntro(q.get('intro')==='1');setSetupOpen(true);}},[]);
 useEffect(()=>{const query=new URLSearchParams(window.location.search);setTab(tabs.find(item=>item.query===query.get('tab'))?.id??'本部情報');const returnTo=query.get('return');setSafeReturn(returnTo?.startsWith(`/academy/h/${headquarters.id}/manage/offerings/`)?returnTo:null);},[headquarters.id]);
 return <main className={styles.wrap}>
  <div className={styles.titlebar}><div className={styles.en}>SETTINGS</div><h1 className={styles.jp}>本部設定</h1></div>
  <div className={styles.headbox}><p>本部の情報やお支払い方法などを設定します。</p><button className={styles.btn} onClick={()=>{if(panelStatus?.dirty&&!window.confirm("未保存の入力を閉じて案内を開きますか？"))return;setIntro(true);setSetupOpen(true);}}>Academyのご案内</button>{canEdit&&<button className={`${styles.btn} ${styles.orange}`} type="button" disabled={panelStatus?.busy} onClick={openSetup}>初期設定を順番に進める</button>}</div>
  <div className={styles.tabs} aria-label="本部設定の項目">{tabs.map(item=><button key={item.id} type="button" className={`${styles.tab} ${tab===item.id?styles.on:''}`} aria-current={tab===item.id?'page':undefined} onClick={()=>{setTab(item.id);const url=new URL(window.location.href);url.searchParams.set('tab',item.query);window.history.replaceState(null,'',url.toString());}}>{item.label}</button>)}</div>
  {safeReturn&&<div className={styles.card}><a className={styles.linkRow} aria-disabled={!panelStatus||panelStatus.dirty||panelStatus.busy||!!panelStatus.error} href={safeReturn} onClick={event=>{if(!panelStatus||panelStatus.dirty||panelStatus.busy||panelStatus.error)event.preventDefault();}}>← 販売プランへ戻る</a>{panelStatus?.dirty&&<p className={styles.help}>入力欄の「保存する」を押してから戻ってください。</p>}</div>}
  {!setupOpen&&<div hidden={tab==='通知メール'}><HeadquartersSettingsPanels key={headquarters.id+':'+settingsRefresh} headquarters={headquarters} tab={tab} onStatus={setPanelStatus}/></div>}
  {setupOpen&&<AcademyGettingStarted userId={user.id} startWithSetup={!intro} headquarters={headquarters} onClose={()=>{setSetupOpen(false);setSettingsRefresh(v=>v+1);const url=new URL(window.location.href);url.searchParams.delete('onboarding');url.searchParams.delete('intro');window.history.replaceState(null,'',url.toString());}}/>}
  <div hidden={tab!=='通知メール'}><section className={styles.card}><h2>自動で送られるメール</h2><p className={styles.help}>申込受付の自動返信と、メンバーへの招待メールを確認できます。個別の連絡は、普段お使いのメールで行ってください。</p></section>{canEdit?<ReceiptEditor key={headquarters.id} headquartersId={headquarters.id}/>:<p className={styles.note} role="status">申込受付の自動返信は本部運営担当が編集します。</p>}<section className={styles.card}><h2>メンバーへの招待メール</h2><p className={styles.help}>招待元・参加先・役割が入るmikkeOS共通の文面です。本文はここでは編集しません。招待する方と役割は「役割・権限」で指定します。</p><p className={styles.note}>送信前に内容を確認できます。送信結果は「役割・権限」の招待ごとに確認できます。</p><StaffInvitationMailPreview headquartersName={headquarters.name} roleName="受講運営担当"/><p className={styles.help}>上のプレビューは「受講運営担当」の例です。招待時には選んだ役割で確認できます。</p><button type="button" className={styles.btn} onClick={()=>{setTab('役割・権限');const url=new URL(window.location.href);url.searchParams.set('tab','roles');window.history.replaceState(null,'',url.toString());}}>招待する方と役割を設定する</button></section></div>
 </main>;
}

function ReceiptEditor({headquartersId}:{headquartersId:string}) {
 const [saved,setSaved]=useState<Academy2ReceiptMailSettings|null>(null);
 const [body,setBody]=useState<string|null>(null);
 const [busy,setBusy]=useState<'load'|'save'|null>('load');
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [retry,setRetry]=useState(0);
 const [preview,setPreview]=useState<string|null>(null);
 const [latest,setLatest]=useState<Academy2ReceiptMailSettings|null>(null);
 const [conflict,setConflict]=useState(false);
 const mounted=useRef(true);
 const textarea=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{let current=true;setBusy('load');setError('');
  getAcademy2ReceiptMailSettings(headquartersId).then(value=>{if(current){setSaved(value);setBody(value.body);}})
   .catch(cause=>{if(current)setError(cause instanceof Error?cause.message:'本文を読み込めませんでした。');})
   .finally(()=>{if(current)setBusy(null);});return()=>{current=false;};
 },[headquartersId,retry]);
 const dirty=!!saved&&body!==saved.body;
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 const edit=(value:string|null)=>{setBody(value);setMessage('');setPreview(null);};
 async function showPreview(){const errors=validateBody(body);if(errors.length){setError(errors.join(' '));return;}setBusy('load');setError('');try{const settings=await getHeadquartersSettings(headquartersId);const r=receiptV2({name:'プレビュー用のお名前',title:'プレビュー用の販売プラン',price:10000,method:'bank',body_override:body,bank_note:settings.basic.default_payment_note||'振込先はまだ設定されていません。本部設定のお支払いで登録してください。',headquartersName:settings.basic.name,contactEmail:settings.basic.contact_email,event:{startsAt:'2027-02-20T01:00:00Z'}},window.location.origin);setPreview(r.subject+'\n\n'+r.text);}catch{setError('メールの内容を確認できませんでした。');}finally{setBusy(null);}}

 function insert(value:string){const target=textarea.current;const text=body??RECEIPT_V2_BODY;const start=target?.selectionStart??text.length;const end=target?.selectionEnd??start;edit(text.slice(0,start)+value+text.slice(end));requestAnimationFrame(()=>{target?.focus();target?.setSelectionRange(start+value.length,start+value.length);});}
 async function save(){if(!saved||busy)return;const errors=validateBody(body);if(errors.length){setError(errors.join(' '));return;}setBusy('save');setError('');setMessage('');
  try{const value=await saveAcademy2ReceiptMailSettings(headquartersId,saved.version,body);if(mounted.current){setSaved(value);setBody(value.body);setLatest(null);setConflict(false);setMessage('保存しました');}}
  catch(cause){if(mounted.current){setError(cause instanceof Error?cause.message:'保存を確認できませんでした。入力内容は残っています。');setConflict((cause as {code?:string})?.code==='PT409');}}
  finally{if(mounted.current)setBusy(null);}
 }
 async function checkLatest(){setBusy('load');setError('');try{const value=await getAcademy2ReceiptMailSettings(headquartersId);if(mounted.current){setLatest(value);setMessage('最新の保存済み本文を取得しました。編集中の本文は残っています。');}}catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:'最新の本文を取得できませんでした。');}finally{if(mounted.current)setBusy(null);}}
 if(!saved)return <div className={styles.note}>{busy?<p role="status">申込受付メールを読み込んでいます…</p>:<><p role="alert">{error}</p><button className={styles.btn} type="button" onClick={()=>setRetry(value=>value+1)}>もう一度読み込む</button></>}</div>;
 return <section className={styles.mailLayout} aria-label="メール設定">
  <div className={styles.mailList}><strong>申込受付の自動返信</strong><p className={styles.help}>お申し込みを受け付けたときに、申込者へ自動で送るメールです。</p></div>
  <div className={styles.mailEditor}><h2>申込受付の自動返信メール</h2><p className={styles.help}>受付メールの冒頭を編集できます。金額・支払い方法・申込先・問い合わせ先は後ろに自動で入ります。銀行振込では振込先、外部決済では決済URLを案内します。</p>
   <div className={styles.field}><label htmlFor="receipt-subject">件名（自動設定）</label><input id="receipt-subject" value="【Academy】「販売プラン名」へのお申し込みを受け付けました" readOnly/></div>
   <div className={styles.field}><label htmlFor="receipt-body">本文</label><textarea ref={textarea} id="receipt-body" value={body??RECEIPT_V2_BODY} disabled={busy!==null} onChange={event=>edit(event.target.value)} aria-describedby="receipt-status"/></div>
   <div className={styles.chips}>{variables.map(variable=><button key={variable.value} type="button" className={styles.chip} disabled={busy!==null} onClick={()=>insert(variable.value)}>＋{variable.label}</button>)}</div>
   <div className={styles.actions}><button type="button" className={styles.btn} disabled={busy!==null} onClick={showPreview}>送られる内容を確認する</button><button type="button" className={styles.btn} disabled={busy!==null} onClick={()=>edit(null)}>既定に戻す</button><button type="button" className={`${styles.btn} ${styles.orange}`} disabled={busy!==null||!dirty||conflict} onClick={()=>void save()}>{busy==='save'?'保存中…':'保存する'}</button></div>
   <p id="receipt-status" role="status" className={styles.help}>{busy==='save'?'保存中です。':error?'保存できていません。':dirty?'未保存の変更があります。':message||''}{body===null&&dirty?' 保存すると既定の本文に戻ります。':''}</p>
   {error?<p role="alert" className={styles.error}>{error}</p>:null}
   {conflict?<button type="button" className={styles.btn} disabled={busy!==null} onClick={()=>void checkLatest()}>最新の保存状態を確認</button>:null}
   {latest?<div className={styles.note}><h3>最新の保存済み本文</h3><pre>{latest.body??RECEIPT_V2_BODY}</pre><p>編集中の本文と確認してから、使う本文を選んでください。</p><div className={styles.actions}><button className={styles.btn} type="button" onClick={()=>{setSaved(latest);edit(latest.body);setLatest(null);setConflict(false);setError('');}}>最新の本文を使う</button><button className={styles.btn} type="button" onClick={()=>{setSaved(latest);setLatest(null);setConflict(false);setError('');setMessage('編集中の本文を残しました。保存すると反映されます。');}}>編集中の本文を残す</button></div></div>:null}
   {preview!==null?<div className={styles.note}><h3>自動返信メールのプレビュー</h3><p>お名前・販売プラン・金額・日時は確認用の例です。振込先と問い合わせ先には保存済みの本部情報を表示しています。メールは送信しません。</p><pre>{preview}</pre><button type="button" className={styles.btn} onClick={()=>setPreview(null)}>プレビューを閉じる</button></div>:null}
  </div>
 </section>;
}
