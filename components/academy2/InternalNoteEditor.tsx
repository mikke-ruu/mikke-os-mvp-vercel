'use client';
import {useEffect,useRef,useState} from 'react';
import {saveInternalNote} from '@/lib/academy2/headquarters-applications';
import type {ApplicationHistory} from '@/lib/academy2/headquarters-applications';
import styles from './applications-operation.module.css';
export function InternalNoteEditor({hq,subject,onSaved,participant=false}:{hq:string;subject:string;onSaved:(items:ApplicationHistory[])=>void;participant?:boolean}){
 const [body,setBody]=useState(''),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState(''),[error,setError]=useState('');
 const request=useRef<{body:string;id:string}|null>(null),lock=useRef(false);
 useEffect(()=>{if(!body)return;const guard=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[body]);
 useEffect(()=>{if(!body)return;const guard=(e:MouseEvent)=>{const a=(e.target as Element)?.closest?.('a[href]');if(a&&a.getAttribute('href')&&!a.getAttribute('href')!.startsWith('#')&&!window.confirm('保存していないメモがあります。画面を移動しますか？')){e.preventDefault();e.stopImmediatePropagation();}};document.addEventListener('click',guard,true);return()=>document.removeEventListener('click',guard,true);},[body]);
 async function save(){if(lock.current||!body.trim())return;lock.current=true;setBusy(true);setFeedback('');setError('');if(request.current?.body!==body)request.current={body,id:crypto.randomUUID()};try{onSaved(await saveInternalNote(hq,subject,request.current.id,body));setBody('');request.current=null;setFeedback('保存しました');}catch(e){setError(e instanceof Error?e.message:'保存できませんでした。入力内容は残っています。');}finally{lock.current=false;setBusy(false);}}
 return <div className={styles.noteEditor}><label>{participant?'受講者についてのメモ（任意）':'この申込のメモ（任意）'}<textarea className={styles.operationInput} value={body} maxLength={2000} disabled={busy} placeholder={participant?'今後の受講希望など':'振替のご相談など'} onChange={e=>{setBody(e.target.value);setFeedback('');}}/></label><p>本部の運営用です。受講者には表示されません。</p><button type="button" className={styles.button} disabled={busy||!body.trim()} onClick={()=>void save()}>{busy?'保存中…':'メモを保存する'}</button>{error?<p role="alert">{error}</p>:<p role="status" className={styles.inlineFeedback}>{feedback}</p>}</div>;
}
