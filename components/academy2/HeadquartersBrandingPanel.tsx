'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {AcademyImageUploader} from '@/components/academy/AcademyImageUploader';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import {getHeadquartersBranding,saveHeadquartersBranding,type HeadquartersBranding} from '@/lib/academy2/headquarters-branding';
import styles from './headquarters-settings.module.css';

export function HeadquartersBrandingPanel({headquartersId,canEdit,basicSavedAt,onSaved}:{headquartersId:string;canEdit:boolean;basicSavedAt?:string|null;onSaved?:(value:HeadquartersBranding)=>void}){
 const [saved,setSaved]=useState<HeadquartersBranding|null>(null);
 const [logo,setLogo]=useState<string|null>(null),[hero,setHero]=useState<string|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setBusy(true);setError('');getHeadquartersBranding(headquartersId).then(value=>{if(live){setSaved(value);setLogo(value.logo_url);setHero(value.hero_image_url);}}).catch(cause=>{if(live)setError(cause instanceof Error?cause.message:'画像を読み込めませんでした。');}).finally(()=>{if(live)setBusy(false);});return()=>{live=false;};},[headquartersId,retry]);
 const dirty=!!saved&&(logo!==saved.logo_url||hero!==saved.hero_image_url);
 useEffect(()=>{if(basicSavedAt)setSaved(value=>value?{...value,updated_at:basicSavedAt}:value);},[basicSavedAt,!!saved]);
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 async function save(){if(!saved||!dirty||busy)return;setBusy(true);setError('');setMessage('');try{const value=await saveHeadquartersBranding(headquartersId,saved.updated_at,logo,hero);setSaved(value);setLogo(value.logo_url);setHero(value.hero_image_url);onSaved?.(value);setMessage('保存しました');}catch(cause){setError(cause instanceof Error?cause.message:'保存できませんでした。');}finally{setBusy(false);}}
 return <section className={styles.card} aria-label="本部の画像"><h2>本部の画像</h2><p className={styles.help}>本部の画像とロゴを登録します。</p><p className={styles.help}>本部ホームとホームページの初期設定に使用します。ホームページでは別の画像に変更できます。</p>
 {!saved&&<div role={error?'alert':'status'} className={styles.help}>{error||'画像を読み込んでいます…'}{error&&<button type="button" className={styles.btn} onClick={()=>setRetry(v=>v+1)}>再読込</button>}</div>}
 {saved&&<><div className={styles.field}><label>本部のイメージ画像</label>{canEdit?<AcademyImageUploader compact currentUrl={hero??undefined} onUploaded={url=>{setHero(url);setMessage('');}}/>:hero?<img src={hero} alt="現在の本部イメージ画像" style={{maxWidth:'100%',maxHeight:180}}/>:<p className={styles.help}>未設定</p>}{canEdit&&hero&&<button type="button" className={styles.btn} onClick={()=>setHero(null)}>画像を外す</button>}</div>
 <div className={styles.field}><label>本部のロゴ</label>{canEdit?<AcademyImageUploader compact currentUrl={logo??undefined} onUploaded={url=>{setLogo(url);setMessage('');}}/>:logo?<img src={logo} alt="現在の本部ロゴ" style={{maxWidth:120,maxHeight:120}}/>:<p className={styles.help}>未設定</p>}{canEdit&&logo&&<button type="button" className={styles.btn} onClick={()=>setLogo(null)}>ロゴを外す</button>}</div>
 <div className={styles.actions}>{canEdit&&<button type="button" className={`${styles.btn} ${styles.orange}`} disabled={busy||!dirty} onClick={()=>void save()}>{busy?'保存中…':'画像を保存する'}</button>}</div><p role="status" className={styles.help}>{message|| (dirty?'未保存の画像があります。':'')}</p><Link className={styles.linkRow} href={toAcademyContextHref('/academy/front',headquartersId,'manage')}>ホームページの内容を編集する →</Link></>}
 {error&&saved&&<p role="alert" className={styles.error}>{error}</p>}</section>;
}
