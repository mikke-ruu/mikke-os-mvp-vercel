'use client';
import {useEffect,useState} from 'react';
import type {Academy2HeadquartersContext} from '@/lib/academy2/context';
import type {HeadquartersSetupApi} from '@/lib/academy2/headquarters-setup-api';
import {bankNoteReady} from '@/lib/academy2/bank-note.mjs';
import {HeadquartersSettingsPanels,type SettingsPanelStatus} from './HeadquartersSettingsPanels';
import styles from './common-creation.module.css';
export function InlineCreationBank({headquarters,api,onSaved,onBlocked}:{headquarters:Academy2HeadquartersContext;api:HeadquartersSetupApi;onSaved:(note:string)=>void;onBlocked:(value:boolean)=>void}){
 const [panel,setPanel]=useState<SettingsPanelStatus|null>(null),[saving,setSaving]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{onBlocked(!panel||!!panel.dirty||!!panel.busy||saving||!!error);},[panel?.dirty,panel?.busy,saving,!!panel,error,onBlocked]);
 useEffect(()=>()=>onBlocked(false),[onBlocked]);
 async function save(){if(saving||!panel||panel.busy)return;setSaving(true);setError('');setMessage('');try{if(panel.dirty&&await panel.save?.()===false)return;const settings=await api.getSettings(headquarters.id);if(!bankNoteReady(settings.basic.default_payment_note))throw Error('振込先の必須項目を入力してください。');const pref=await api.getBankPreference(headquarters.id);if(pref.useBank!==true){await api.saveBankPreference(headquarters.id,pref.revision,true);const verified=await api.getBankPreference(headquarters.id);if(verified.useBank!==true)throw Error('保存結果を確認できませんでした。');}onSaved(settings.basic.default_payment_note);setMessage('保存しました');}catch(cause){setError(cause instanceof Error?cause.message:'保存できませんでした。');}finally{setSaving(false);}}
 return <section className={styles.card} aria-label="振込先の入力"><p>この本部で共通の振込先です。変更は、ほかの講座・販売プランの今後の振込案内にも反映されます。すでに送信したメールの内容は変わりません。</p><HeadquartersSettingsPanels headquarters={headquarters} tab="支払" api={api} footerControls onStatus={setPanel}/><button type="button" className={styles.primary} disabled={saving||!panel||panel.busy||panel.dirty&&!panel.canSave} onClick={()=>void save()}>振込先を保存する</button><p role="status">{saving?'保存中…':message}</p>{(error||panel?.error)&&<p role="alert">{error||panel?.error}</p>}</section>;
}
