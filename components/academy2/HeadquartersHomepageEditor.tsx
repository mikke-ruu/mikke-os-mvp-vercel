'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {getHeadquartersFront,saveHeadquartersFront,publishHeadquartersFront,type HeadquartersFront} from '@/lib/academy2/headquarters-front';
import {AcademyImageUploader} from '@/components/academy/AcademyImageUploader';
import {readFrontDocument,writeFrontDocument,frontMaxWidth,defaultFrontDesign,type AcademyFrontDesign} from '@/lib/academy/front-design';
import type {AcademyLpBlock} from '@/types/database';
import {AcademyFrontHero} from '@/components/academy/AcademyFrontHero';
import {AcademyFrontDesignEditor} from '@/components/academy/AcademyFrontDesignEditor';
import {AcademyLpEditor} from '@/components/academy/AcademyLpEditor';
import {HeadquartersHomepagePresentation} from './HeadquartersHomepagePresentation';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import styles from './homepage-editor.module.css';

// PostgreSQL jsonb returns object keys in its own order; array order remains meaningful.
const stableJson=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const identityOf=(front:HeadquartersFront)=>({name:front.name,tagline:front.tagline??'',hero_image_url:front.hero_image_url??null,logo_url:front.logo_url??null,contact_email:front.contact_email??''});
type PageIdentity=ReturnType<typeof identityOf>;
const signature=(message:string,design:AcademyFrontDesign,blocks:AcademyLpBlock[],identity:PageIdentity)=>stableJson({message,design,blocks,identity});
/** Preview remains local; saving a draft never moves the public revision. */
export function HeadquartersHomepageEditor({headquartersId}:{headquartersId:string}){
 const search=useSearchParams();
 const [front,setFront]=useState<HeadquartersFront|null>(null),[identity,setIdentity]=useState<PageIdentity>({name:'',tagline:'',hero_image_url:null,logo_url:null,contact_email:''});
 const [message,setMessage]=useState(''),[design,setDesign]=useState(defaultFrontDesign),[blocks,setBlocks]=useState<AcademyLpBlock[]>([]);
 const [area,setArea]=useState<'settings'|'body'>('settings'),[preview,setPreview]=useState(search.get('preview')==='1');
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [baseline,setBaseline]=useState(''),[retry,setRetry]=useState(0),[confirm,setConfirm]=useState<false|'publish'|'hide'>(false);
 const inFlight=useRef(false),generation=useRef(0),confirmation=useRef<HTMLDialogElement>(null);
 const dirty=!!front&&signature(message,design,blocks,identity)!==baseline;
 const href=(path:string)=>toAcademyContextHref(path,headquartersId,'manage');
 useEffect(()=>{let active=true;setLoading(true);setError('');setFront(null);
  getHeadquartersFront(headquartersId).then(value=>{if(!active)return;const doc=readFrontDocument(value.front_blocks),meta=identityOf(value);setFront(value);setIdentity(meta);setMessage(value.front_message??'');setBlocks(doc.blocks);setDesign(doc.design);setBaseline(signature(value.front_message??'',doc.design,doc.blocks,meta));}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'ホームページを読み込めませんでした。');}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;generation.current++;};
 },[headquartersId,retry]);
 useEffect(()=>{if(!dirty)return;const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty]);
 useEffect(()=>{if(!dirty&&!saving)return;const guard=(event:MouseEvent)=>{const anchor=event.target instanceof Element?event.target.closest('a'):null;if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download'))return;const target=new URL(anchor.href,location.href);if(target.href===location.href||target.pathname===location.pathname&&target.search===location.search)return;if(saving||!window.confirm('保存していない変更があります。このページから移動しますか？')){event.preventDefault();event.stopPropagation();}};document.addEventListener('click',guard,true);return()=>document.removeEventListener('click',guard,true);},[dirty,saving]);
 useEffect(()=>{if(confirm){if(!confirmation.current?.open)confirmation.current?.showModal();}else confirmation.current?.close();},[confirm]);
 function change(){setNotice('');setError('');}
 function editIdentity(value:Partial<PageIdentity>){change();setIdentity(previous=>({...previous,...value}));}
 async function save(){if(!front||(!dirty&&!!front.homepage_revision)||inFlight.current)return;const current=generation.current,meta={...identity,name:identity.name.trim()},snapshot=signature(message,design,blocks,meta);inFlight.current=true;setSaving(true);setError('');setNotice('');setConfirm(false);
  try{const result=await saveHeadquartersFront(headquartersId,front.updated_at,{...meta,tagline:meta.tagline||null,contact_email:meta.contact_email||null,front_message:message||null,front_blocks:writeFrontDocument(blocks,design)});if(current!==generation.current)return;
   // Verify server projection before showing success; keep any newer local edits.
   const verified=await getHeadquartersFront(headquartersId);if(current!==generation.current)return;
   if(verified.updated_at!==result.updated_at||verified.front_message!==result.front_message||stableJson(verified.front_blocks)!==stableJson(result.front_blocks))throw Error('保存後の状態を確認できませんでした。入力内容は保持しています。');
   const doc=readFrontDocument(verified.front_blocks);if(signature(verified.front_message??'',doc.design,doc.blocks,identityOf(verified))!==snapshot)throw Error('保存した内容の一致を確認できませんでした。入力内容は保持しています。');
   setFront(verified);setIdentity(identityOf(verified));setBaseline(snapshot);setNotice('下書きを保存しました。');
  }catch(cause){if(current===generation.current)setError(cause instanceof Error?cause.message:'保存できませんでした。入力内容は保持しています。');}finally{inFlight.current=false;if(current===generation.current)setSaving(false);}
 }
 async function publish(){if(!front||dirty||!confirm||inFlight.current)return;const current=generation.current,publishing=confirm==='publish';inFlight.current=true;setSaving(true);setError('');setNotice('');setConfirm(false);
  try{const result=await publishHeadquartersFront(headquartersId,front.updated_at,publishing);const verified=await getHeadquartersFront(headquartersId);if(current!==generation.current)return;
   if(verified.updated_at!==result.updated_at||verified.publication_state!==(publishing?'published':'hidden'))throw Error('公開状態の再取得を確認できませんでした。');
   setFront(verified);setNotice(publishing?'変更を公開しました。':'ホームページを非公開にしました。販売プランや既存のお申し込みは変更していません。');
  }catch(cause){if(current===generation.current)setError(cause instanceof Error?cause.message:'公開状態を変更できませんでした。');}finally{inFlight.current=false;if(current===generation.current)setSaving(false);}
 }
 if(loading)return <p role="status" className={styles.wrap}>ホームページを読み込んでいます…</p>;
 if(!front)return <div role="alert" className={styles.wrap}><p>{error||'ホームページを取得できませんでした。'}</p><button onClick={()=>setRetry(v=>v+1)}>再読み込み</button></div>;
 const projection={...front,...identity,front_message:message,front_blocks:writeFrontDocument(blocks,design)};
 return <div className={preview?styles.previewWrap:styles.wrap}>
  <div className={styles.heading}><div><span>HOMEPAGE</span><h1>ホームページ</h1></div><div className={styles.actions}><button type="button" onClick={()=>setPreview(value=>!value)}>{preview?'編集へ戻る':'プレビュー'}</button><Link href={href('/academy')}>ホームへ</Link></div></div>
  {preview?<><p className={styles.note}>編集中の内容です。この確認では保存・公開しません。</p><HeadquartersHomepagePresentation front={projection}/></>:<>
   <nav className={styles.tabs} aria-label="ホームページの編集場所"><button aria-current={area==='settings'?'page':undefined} onClick={()=>setArea('settings')}>ホームページ設定</button><button aria-current={area==='body'?'page':undefined} onClick={()=>setArea('body')}>ホームページを編集</button></nav>
   {area==='settings'?<section className={styles.card} aria-label="ホームページ設定"><h2>ホームページ設定</h2><div className={styles.fields}>
    <label>本部・教室名 必須<input maxLength={100} readOnly={!front.can_edit_identity} disabled={saving} value={identity.name} onChange={event=>editIdentity({name:event.target.value})}/></label><label>キャッチコピー<input maxLength={4000} readOnly={!front.can_edit_identity} disabled={saving} value={identity.tagline} onChange={event=>editIdentity({tagline:event.target.value})}/></label>
    <p className={styles.note}>ホームページの内容だけを変更します。本部設定には反映されません。</p>
    <label className={styles.full}>紹介文<textarea rows={5} value={message} disabled={saving} onChange={event=>{change();setMessage(event.target.value);}}/></label>
    <div><h3>メイン画像</h3>{front.can_edit_identity&&!saving?<AcademyImageUploader compact currentUrl={identity.hero_image_url??undefined} onUploaded={url=>editIdentity({hero_image_url:url})}/>:identity.hero_image_url?<img className={styles.image} src={identity.hero_image_url} alt="ホームページのメイン画像"/>:<p className={styles.note}>未設定</p>}{front.can_edit_identity&&identity.hero_image_url&&<button type="button" disabled={saving} onClick={()=>editIdentity({hero_image_url:null})}>画像を外す</button>}</div>
    <div><h3>ロゴ</h3>{front.can_edit_identity&&!saving?<AcademyImageUploader compact currentUrl={identity.logo_url??undefined} onUploaded={url=>editIdentity({logo_url:url})}/>:identity.logo_url?<img className={styles.logo} src={identity.logo_url} alt="ホームページのロゴ"/>:<p className={styles.note}>未設定</p>}{front.can_edit_identity&&identity.logo_url&&<button type="button" disabled={saving} onClick={()=>editIdentity({logo_url:null})}>ロゴを外す</button>}</div>
   </div><AcademyFrontDesignEditor homepageLabels design={design} title={identity.tagline} message={message} imageUrl={identity.hero_image_url??''} onChange={value=>{change();setDesign(value);}}/>
   <Link className={styles.link} href={href('/academy/settings')}>本部情報・画像の設定へ</Link>
   </section>:<section className={styles.editor}><AcademyLpEditor title={identity.name} blocks={blocks} previewMaxWidth={frontMaxWidth(design)} onChange={value=>{change();setBlocks(value);}} pageHeader={<AcademyFrontHero hideEmptyImage design={design} title={identity.tagline||identity.name} message={message||`${identity.name}の講座やワークショップをご紹介します。`} imageUrl={identity.hero_image_url??''} applicationHref={null} coursesHref={null}/>}/></section>}
  </>}
  <footer className={styles.savebar}><p className={styles.note}>{front.publicly_available?'公開中':front.publication_state==='hidden'?'非公開':'未公開'}{dirty?'・未保存の変更があります。':'・下書きの保存だけでは公開内容は変わりません。'}</p><div className={styles.actions}><button type="button" disabled={!dirty||saving} onClick={()=>{if(!window.confirm('保存していない変更を取り消しますか？'))return;const doc=readFrontDocument(front.front_blocks);setMessage(front.front_message??'');setDesign(doc.design);setBlocks(doc.blocks);setIdentity(identityOf(front));setBaseline(signature(front.front_message??'',doc.design,doc.blocks,identityOf(front)));setError('');setNotice('');}}>変更を取り消す</button><button type="button" className={styles.primary} disabled={(!dirty&&!!front.homepage_revision)||saving} onClick={()=>void save()}>{saving?'保存中…':'下書き保存'}</button><button type="button" className={styles.primary} disabled={saving||dirty||!front.homepage_revision} onClick={()=>setConfirm('publish')}>変更を公開</button>{front.publicly_available?<button type="button" disabled={saving||dirty||!front.homepage_revision} onClick={()=>setConfirm('hide')}>非公開にする</button>:null}</div><p role="status" aria-live="polite" className={styles.note}>{notice|| (dirty?'未保存の変更があります。':'保存済みの内容です。')}</p>{error&&<p role="alert" className={styles.error}>{error}</p>}</footer>
  <dialog ref={confirmation} className={styles.confirmation} onCancel={()=>setConfirm(false)} onClose={()=>setConfirm(false)}><h2>{confirm==='hide'?'ホームページを非公開にしますか？':'保存した変更を公開しますか？'}</h2><p>{confirm==='hide'?'ホームページの表示を停止します。販売プランや既存のお申し込みは維持します。':'下書き保存した内容を、お客様向けのホームページに反映します。'}</p><div className={styles.actions}><button type="button" onClick={()=>setConfirm(false)}>戻る</button><button type="button" className={styles.primary} disabled={saving} onClick={()=>void publish()}>確認して変更する</button></div></dialog>
 </div>;
}
