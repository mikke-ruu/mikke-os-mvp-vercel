"use client";

import { useEffect, useRef, useState } from 'react';
import type { Academy2HeadquartersContext } from '@/lib/academy2/context';
import { getAcademy2ReceiptMailSettings, saveAcademy2ReceiptMailSettings, type Academy2ReceiptMailSettings } from '@/lib/academy2/receipt-mail-settings';
import { DEFAULT_BODIES, MAIL_SUBJECTS, renderPlainBody, validateBody } from '@/lib/academy/offering-mail-content.mjs';
import styles from './headquarters-settings.module.css';
import { HeadquartersSettingsPanels } from './HeadquartersSettingsPanels';

const tabs = ['本部情報','決済','規約・契約','通知メール','お知らせ','Community','役割・権限','利用料金'];
const kinds = ['申込受付','支払い案内','支払確認','日程確定','開催前案内','認定完了','証書発行','講師登録案内','開講ライセンス','キット発送','修了報告'];
const variables = [{label:'お名前',value:'{{name}}'},{label:'講座名',value:'{{title}}'},{label:'金額',value:'{{price}}'}];

/** UI31 v0.1 layout. Only receipt body persistence is connected; this component never dispatches mail. */
export function Academy2HeadquartersSettings({headquarters}:{headquarters:Academy2HeadquartersContext}) {
 const canEdit = headquarters.role === 'administrator';
 const [tab,setTab]=useState('本部情報');
 return <main className={styles.wrap}>
  <div className={styles.titlebar}><div className={styles.en}>SETTINGS</div><h1 className={styles.jp}>本部設定</h1></div>
  <div className={styles.headbox}><p>Academy本部の基本情報・決済・規約・通知・Community・権限など、共通設定を管理します。</p></div>
  <div className={styles.tabs} aria-label="本部設定の項目">{tabs.map(item=><button key={item} type="button" className={`${styles.tab} ${tab===item?styles.on:''}`} aria-current={tab===item?'page':undefined} onClick={()=>setTab(item)}>{item}</button>)}</div>
  <HeadquartersSettingsPanels key={headquarters.id} headquarters={headquarters} tab={tab}/>
  <div hidden={tab!=='通知メール'}>{canEdit?<ReceiptEditor key={headquarters.id} headquartersId={headquarters.id}/>:<p className={styles.note} role="status">通知メールの本文は本部運営担当が編集します。</p>}</div>
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
 function showPreview(){const errors=validateBody(body);if(errors.length){setError(errors.join(' '));return;}setError('');setPreview(renderPlainBody('receipt',body,{headquarters_id:headquartersId,application_id:'プレビュー',name:'プレビュー用のお名前',title:'プレビュー用の販売プラン',price:10000,payment_method:'bank'},window.location.origin));}
 function insert(value:string){const target=textarea.current;const text=body??DEFAULT_BODIES('receipt');const start=target?.selectionStart??text.length;const end=target?.selectionEnd??start;edit(text.slice(0,start)+value+text.slice(end));requestAnimationFrame(()=>{target?.focus();target?.setSelectionRange(start+value.length,start+value.length);});}
 async function save(){if(!saved||busy)return;const errors=validateBody(body);if(errors.length){setError(errors.join(' '));return;}setBusy('save');setError('');setMessage('');
  try{const value=await saveAcademy2ReceiptMailSettings(headquartersId,saved.version,body);if(mounted.current){setSaved(value);setBody(value.body);setLatest(null);setConflict(false);setMessage('保存しました。');}}
  catch(cause){if(mounted.current){setError(cause instanceof Error?cause.message:'保存を確認できませんでした。入力内容は残っています。');setConflict((cause as {code?:string})?.code==='PT409');}}
  finally{if(mounted.current)setBusy(null);}
 }
 async function checkLatest(){setBusy('load');setError('');try{const value=await getAcademy2ReceiptMailSettings(headquartersId);if(mounted.current){setLatest(value);setMessage('最新の保存済み本文を取得しました。編集中の本文は残っています。');}}catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:'最新の本文を取得できませんでした。');}finally{if(mounted.current)setBusy(null);}}
 if(!saved)return <div className={styles.note}>{busy?<p role="status">申込受付メールを読み込んでいます…</p>:<><p role="alert">{error}</p><button className={styles.btn} type="button" onClick={()=>setRetry(value=>value+1)}>もう一度読み込む</button></>}</div>;
 return <section className={styles.mailLayout} aria-label="通知メール">
  <div className={styles.mailList}>{kinds.map((kind,index)=><button key={kind} type="button" disabled={index!==0} title={index===0?undefined:'準備中'} className={`${styles.mailItem} ${index===0?styles.on:''}`} aria-current={index===0?'page':undefined}>{kind}</button>)}<p className={styles.help}>申込受付以外は準備中です。</p></div>
  <div className={styles.mailEditor}><h2>通知メールの本文</h2><p className={styles.help}>申込受付メールの本文を編集します。件名の変更と自動送信のON/OFFは準備中です。</p>
   <div className={styles.field}><label htmlFor="receipt-subject">件名（自動設定）</label><input id="receipt-subject" value={MAIL_SUBJECTS.receipt} readOnly/></div>
   <div className={styles.field}><label htmlFor="receipt-body">本文</label><textarea ref={textarea} id="receipt-body" value={body??DEFAULT_BODIES('receipt')} disabled={busy!==null} onChange={event=>edit(event.target.value)} aria-describedby="receipt-status"/></div>
   <div className={styles.chips}>{variables.map(variable=><button key={variable.value} type="button" className={styles.chip} disabled={busy!==null} onClick={()=>insert(variable.value)}>＋{variable.label}</button>)}<button className={styles.chip} type="button" disabled title="準備中">＋開催日時</button><button className={styles.chip} type="button" disabled title="準備中">＋講師名</button></div>
   <div className={styles.actions}><button type="button" className={styles.btn} disabled={busy!==null} onClick={showPreview}>プレビュー</button><button type="button" className={styles.btn} disabled={busy!==null} onClick={()=>edit(null)}>既定に戻す</button><button type="button" className={`${styles.btn} ${styles.orange}`} disabled={busy!==null||!dirty||conflict} onClick={()=>void save()}>{busy==='save'?'保存中…':'保存'}</button></div>
   <p id="receipt-status" role="status" className={styles.help}>{busy==='save'?'保存中です。':error?'保存できていません。':dirty?'未保存の変更があります。':message||'保存済みの本文です。'}{body===null&&dirty?' 保存すると既定の本文に戻ります。':''}</p>
   {error?<p role="alert" className={styles.error}>{error}</p>:null}
   {conflict?<button type="button" className={styles.btn} disabled={busy!==null} onClick={()=>void checkLatest()}>最新の保存状態を確認</button>:null}
   {latest?<div className={styles.note}><h3>最新の保存済み本文</h3><pre>{latest.body??DEFAULT_BODIES('receipt')}</pre><p>編集中の本文と確認してから、使う本文を選んでください。</p><div className={styles.actions}><button className={styles.btn} type="button" onClick={()=>{setSaved(latest);edit(latest.body);setLatest(null);setConflict(false);setError('');}}>最新の本文を使う</button><button className={styles.btn} type="button" onClick={()=>{setSaved(latest);setLatest(null);setConflict(false);setError('');setMessage('編集中の本文を残しました。保存すると反映されます。');}}>編集中の本文を残す</button></div></div>:null}
   {preview!==null?<div className={styles.note}><h3>プレビュー</h3><p>確認用のお名前・販売プラン・金額です。メールは送信しません。</p><pre>{preview}</pre></div>:null}
   <div className={styles.linkRow}><span>通知メールのログを見る</span><span className={styles.help}>準備中</span></div>
  </div>
 </section>;
}
