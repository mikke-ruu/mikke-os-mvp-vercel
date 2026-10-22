'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {getMusubiLegacyPaidAdapter} from '@/lib/academy/musubi-legacy-adapter';
export function MusubiBankNoteEditor({userId,headquartersId}:{userId:string;headquartersId:string|null}){
 const adapter=useMemo(()=>getMusubiLegacyPaidAdapter(userId,headquartersId),[userId,headquartersId]);
 const [note,setNote]=useState(''),[ready,setReady]=useState(false),[saving,setSaving]=useState(false),[message,setMessage]=useState('');const revision=useRef(0);
 useEffect(()=>{let live=true;setReady(false);setMessage('');if(!adapter)return()=>{live=false;};adapter.read().then(row=>{if(live){setNote(row.default_payment_note??'');setReady(true);}}).catch(()=>{if(live)setMessage('振込案内を読み込めません。再読み込みしてください。');});return()=>{live=false;};},[adapter]);
 if(!adapter)return null;
 async function save(){if(!adapter||!ready||saving)return;const at=revision.current;setSaving(true);setMessage('');try{const row=await adapter.saveBankNote(note);if(at===revision.current){setNote(row.default_payment_note??'');setMessage('振込案内を保存しました。');}else setMessage('保存しました。続けて編集した内容はまだ保存されていません。');}catch{setMessage('保存結果を確認できません。再読み込みして確認してください。');}finally{setSaving(false);}}
 return <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5"><h2 className="text-lg font-bold">銀行振込の案内</h2><p className="mt-2 text-sm">銀行名・支店・口座・名義・振込期限を入力してください。</p>{ready&&!note.trim()&&<p role="status" className="mt-2 text-sm">振込案内が未設定です。</p>}<label className="mt-3 block text-sm">申込者へ表示する案内<textarea aria-label="申込者へ表示する振込案内" className="mt-2 min-h-40 w-full rounded-xl border p-3" maxLength={4000} value={note} disabled={!ready||saving} onChange={e=>{revision.current++;setNote(e.target.value);setMessage('');}}/></label><button type="button" className="mt-3 rounded-full bg-[var(--mikke-accent)] px-5 py-3 text-white" disabled={!ready||saving} onClick={()=>void save()}>{saving?'保存中…':'振込案内を保存'}</button>{message&&<p role="status" className="mt-2 text-sm">{message}</p>}</section>;
}
