'use client';
import {useEffect,useMemo,useRef,useState,type ComponentType} from 'react';
import type {ContentImagePickerProps} from '@/components/mikkeos/content/MikkeBlockFields';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {getHeadquartersFront,saveHeadquartersFront,publishHeadquartersFront,type HeadquartersFront} from '@/lib/academy2/headquarters-front';
import {AcademyImageUploader} from '@/components/academy/AcademyImageUploader';
import {readFrontDocument,writeFrontDocument,frontMaxWidth,defaultFrontDesign,type AcademyFrontDesign} from '@/lib/academy/front-design';
import type {AcademyLpBlock} from '@/types/database';
import {AcademyFrontHero} from '@/components/academy/AcademyFrontHero';
import {AcademyFrontDesignEditor} from '@/components/academy/AcademyFrontDesignEditor';
import {FixedPageRegion,EditablePageRegion} from './EditorPageRegion';
import {LpContent} from '@/components/mikkeos/page-builder/LpDesign';
import {saveAcademyLpContent} from '@/lib/academy/lp-content-adapter';
import {HeadquartersHomepagePresentation} from './HeadquartersHomepagePresentation';
import {AcademyLpEditor} from '@/components/academy/AcademyLpEditor';
import {HeadquartersHomepageLivePreview} from './HeadquartersHomepageLivePreview';
import {listPublishedSalesPages,type PublishedSalesPageSummary} from '@/lib/academy2/plan-publication';
import {getPublicHomepage,type PublicHomepage} from '@/lib/academy/public-homepage';
import {getHomepagePreparation,markHomepageReviewed} from '@/lib/academy2/homepage-preparation';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import styles from './homepage-editor.module.css';
import {HomepageUrlSettings} from './HomepageUrlSettings';
import type {HomepageUrlApi} from './HomepageUrlSettings';
import {getHomepageUrlSettings} from '@/lib/academy2/homepage-url';

// PostgreSQL jsonb returns object keys in its own order; array order remains meaningful.
const stableJson=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const identityOf=(front:HeadquartersFront)=>({name:front.name,tagline:front.tagline??'',hero_image_url:front.hero_image_url??null,logo_url:front.logo_url??null,contact_email:front.contact_email??''});
type PageIdentity=ReturnType<typeof identityOf>;
const signature=(message:string,design:AcademyFrontDesign,blocks:AcademyLpBlock[],identity:PageIdentity)=>stableJson({message,design,blocks,identity});
export type HomepageImagePicker = ComponentType<{currentUrl?:string;onUploaded:(url:string)=>void;compact?:boolean;helperText?:string}>;
export type HomepageEditorApi={load:typeof getHeadquartersFront;save:typeof saveHeadquartersFront;publish:typeof publishHeadquartersFront;preparation:typeof getHomepagePreparation;review:typeof markHomepageReviewed;publicHomepage:typeof getPublicHomepage;url?:HomepageUrlApi;publishedPages?:(hq:string)=>Promise<PublishedSalesPageSummary[]>};
const defaultApi:HomepageEditorApi={load:getHeadquartersFront,save:saveHeadquartersFront,publish:publishHeadquartersFront,preparation:getHomepagePreparation,review:markHomepageReviewed,publicHomepage:getPublicHomepage,publishedPages:listPublishedSalesPages};
/** Preview remains local; saving a draft never moves the public revision. */
export function HeadquartersHomepageEditor({headquartersId,api=defaultApi,onContinue,ImagePicker=AcademyImageUploader,onStateChange,initialGuide}:{headquartersId:string;initialGuide?:boolean;api?:HomepageEditorApi;onContinue?:()=>void;ImagePicker?:HomepageImagePicker;onStateChange?:(state:{dirty:boolean;busy:boolean})=>void}){
 const query=useSearchParams();const token=query.get('homepagePreview');
 return token?<HeadquartersHomepageLivePreview token={token} headquartersId={headquartersId} embedded={query.get('previewFrame')==='1'}/>:<HomepageEditor headquartersId={headquartersId} api={api} onContinue={onContinue} ImagePicker={ImagePicker} onStateChange={onStateChange} initialGuide={initialGuide}/>;
}
function HomepageEditor({headquartersId,api,onContinue,ImagePicker,onStateChange,initialGuide}:{headquartersId:string;initialGuide?:boolean;api:HomepageEditorApi;onContinue?:()=>void;ImagePicker:HomepageImagePicker;onStateChange?:(state:{dirty:boolean;busy:boolean})=>void}){
 const search=useSearchParams();
 const [preferredHandle,setPreferredHandle]=useState<string|null>(null),[urlOpen,setUrlOpen]=useState(false);
 useEffect(()=>{let live=true;setPreferredHandle(null);if(api!==defaultApi&&!api.url)return;const read=api.url?.get??getHomepageUrlSettings;read(headquartersId).then(value=>{if(live){setPreferredHandle(value.preferredHandle);setUrlOpen(value.revision===0);}}).catch(()=>{/* Existing canonical URL remains usable when optional aliases are unavailable. */});return()=>{live=false;};},[headquartersId,api]);
 const BodyImagePicker=useMemo(()=>function ImageField({currentUrl,onSelect}:ContentImagePickerProps){return <ImagePicker currentUrl={currentUrl} onUploaded={publicUrl=>onSelect({publicUrl})}/>;},[ImagePicker]);
 const [front,setFront]=useState<HeadquartersFront|null>(null),[identity,setIdentity]=useState<PageIdentity>({name:'',tagline:'',hero_image_url:null,logo_url:null,contact_email:''});
 const [message,setMessage]=useState(''),[design,setDesign]=useState(defaultFrontDesign),[blocks,setBlocks]=useState<AcademyLpBlock[]>([]);
 const [area,setArea]=useState<'settings'|'body'>('settings');
 const [viewedKey,setViewedKey]=useState<string|null>(null);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [baseline,setBaseline]=useState(''),[retry,setRetry]=useState(0),[confirm,setConfirm]=useState<false|'publish'|'hide'>(false);
 const [hideLibrary,setHideLibrary]=useState(false),[hideInspector,setHideInspector]=useState(false),[reviewedRevision,setReviewedRevision]=useState<number|null>(null),[preparationError,setPreparationError]=useState(''),[publicContent,setPublicContent]=useState<PublicHomepage|null>(null),[publishedPages,setPublishedPages]=useState<PublishedSalesPageSummary[]|undefined>(undefined),[reviewing,setReviewing]=useState(false);
 const channel=useRef<BroadcastChannel|null>(null),previewToken=useRef(''),previewSnapshot=useRef<unknown>(null);
 const inFlight=useRef(false),generation=useRef(0),confirmation=useRef<HTMLDialogElement>(null);
 const dirty=!!front&&signature(message,design,blocks,identity)!==baseline;
 useEffect(()=>{onStateChange?.({dirty,busy:saving||reviewing||Boolean(confirm)});},[dirty,saving,reviewing,confirm,onStateChange]);
 const savedPreviewKey=front?.homepage_revision&&!dirty?front.homepage_revision+':'+front.updated_at:null;
 const hasSavedPreview=!!savedPreviewKey&&viewedKey===savedPreviewKey;
 const guided=initialGuide??search.get('setup')==='1';
 const reviewed=!dirty&&!!front?.homepage_revision&&reviewedRevision===front.homepage_revision;
 const href=(path:string)=>toAcademyContextHref(path,headquartersId,'manage');
 useEffect(()=>{let active=true;api.preparation(headquartersId).then(value=>{if(active){setReviewedRevision(value.reviewed?value.reviewedRevision:null);setPreparationError('');}}).catch(()=>{if(active){setReviewedRevision(null);setPreparationError('ホームページの確認状況を取得できませんでした。');}});return()=>{active=false;};},[headquartersId,retry,api]);
 useEffect(()=>{let active=true;setPublicContent(null);if(front?.handle)api.publicHomepage(front.handle).then(value=>{if(active)setPublicContent(value);}).catch(()=>{});return()=>{active=false;};},[front?.handle,api]);
 useEffect(()=>{let active=true;setPublishedPages(undefined);api.publishedPages?.(headquartersId).then(pages=>{if(active)setPublishedPages(pages);}).catch(()=>{});return()=>{active=false;};},[api,headquartersId]);
 useEffect(()=>()=>{channel.current?.close();},[]);
 useEffect(()=>{channel.current?.postMessage({kind:'snapshot',...previewSnapshot.current as object});},[message,design,blocks,identity,publicContent,publishedPages,baseline,front?.updated_at]);
 useEffect(()=>{let active=true;setLoading(true);setError('');setFront(null);
  api.load(headquartersId).then(value=>{if(!active)return;const doc=readFrontDocument(value.front_blocks),meta=identityOf(value);setFront(value);setIdentity(meta);setMessage(value.front_message??'');setBlocks(doc.blocks);setDesign(doc.design);setBaseline(signature(value.front_message??'',doc.design,doc.blocks,meta));}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'ホームページを読み込めませんでした。');}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;generation.current++;};
 },[headquartersId,retry,api]);
 useEffect(()=>{if(!dirty)return;const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty]);
 useEffect(()=>{if(!dirty&&!saving)return;const guard=(event:MouseEvent)=>{const anchor=event.target instanceof Element?event.target.closest('a'):null;if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download'))return;const target=new URL(anchor.href,location.href);if(target.href===location.href||target.pathname===location.pathname&&target.search===location.search)return;if(saving||!window.confirm('保存していない変更があります。このページから移動しますか？')){event.preventDefault();event.stopPropagation();}};document.addEventListener('click',guard,true);return()=>document.removeEventListener('click',guard,true);},[dirty,saving]);
 useEffect(()=>{if(confirm){if(!confirmation.current?.open)confirmation.current?.showModal();}else confirmation.current?.close();},[confirm]);
 function change(){setNotice('');setError('');}
 function editIdentity(value:Partial<PageIdentity>){change();setIdentity(previous=>({...previous,...value}));}
 async function save(){if(!front||(!dirty&&!!front.homepage_revision)||inFlight.current)return;const current=generation.current,meta={...identity,name:identity.name.trim()},snapshot=signature(message,design,blocks,meta);inFlight.current=true;setSaving(true);setError('');setNotice('');setConfirm(false);
  try{const result=await api.save(headquartersId,front.updated_at,{...meta,tagline:meta.tagline||null,contact_email:meta.contact_email||null,front_message:message||null,front_blocks:writeFrontDocument(blocks,design)});if(current!==generation.current)return;
   // Verify server projection before showing success; keep any newer local edits.
   const verified=await api.load(headquartersId);if(current!==generation.current)return;
   if(verified.updated_at!==result.updated_at||verified.front_message!==result.front_message||stableJson(verified.front_blocks)!==stableJson(result.front_blocks))throw Error('保存後の状態を確認できませんでした。入力内容は保持しています。');
   const doc=readFrontDocument(verified.front_blocks);if(signature(verified.front_message??'',doc.design,doc.blocks,identityOf(verified))!==snapshot)throw Error('保存した内容の一致を確認できませんでした。入力内容は保持しています。');
   setFront(verified);setIdentity(identityOf(verified));setBaseline(snapshot);setNotice('保存しました');
  }catch(cause){if(current===generation.current)setError(cause instanceof Error?cause.message:'保存できませんでした。入力内容は保持しています。');}finally{inFlight.current=false;if(current===generation.current)setSaving(false);}
 }
 async function publish(){if(!front||dirty||!confirm||inFlight.current)return;const current=generation.current,publishing=confirm==='publish';inFlight.current=true;setSaving(true);setError('');setNotice('');setConfirm(false);
  try{const result=await api.publish(headquartersId,front.updated_at,publishing);const verified=await api.load(headquartersId);if(current!==generation.current)return;
   if(verified.updated_at!==result.updated_at||verified.publication_state!==(publishing?'published':'hidden'))throw Error('公開状態の再取得を確認できませんでした。');
   setFront(verified);setNotice(publishing?'ホームページを公開しました。':'ホームページを非公開にしました。販売プランや既存のお申し込みは変更していません。');
  }catch(cause){if(current===generation.current)setError(cause instanceof Error?cause.message:'公開状態を変更できませんでした。');}finally{inFlight.current=false;if(current===generation.current)setSaving(false);}
 }
 if(loading)return <p role="status" className={styles.wrap}>ホームページを読み込んでいます…</p>;
 if(!front)return <div role="alert" className={styles.wrap}><p>{error||'ホームページを取得できませんでした。'}</p><button onClick={()=>setRetry(v=>v+1)}>再読み込み</button></div>;
 const projection={id:front.id,handle:front.handle,name:identity.name,tagline:identity.tagline,hero_image_url:identity.hero_image_url,logo_url:identity.logo_url,contact_email:identity.contact_email,front_message:message,front_blocks:writeFrontDocument(blocks,design),updated_at:front.updated_at};
 previewSnapshot.current={front:projection,courses:publicContent?.courses??[],instructors:publicContent?.instructors??[],publicOfferings:publicContent?.offerings??undefined,publishedPages,savedKey:savedPreviewKey};
 function openLivePreview(){
  if(!('BroadcastChannel' in window)){setError('このブラウザでは別画面のプレビューを開けません。対応するブラウザでお試しください。');return;}
  if(!channel.current){previewToken.current=crypto.randomUUID();const connection=new BroadcastChannel('academy-homepage-'+previewToken.current);connection.onmessage=event=>{if(event.data?.kind==='request')connection.postMessage({kind:'snapshot',...previewSnapshot.current as object});else if(event.data?.kind==='viewed'&&event.data.headquartersId===headquartersId){const latest=previewSnapshot.current as {savedKey?:string|null};if(typeof latest.savedKey==='string'&&event.data.savedKey===latest.savedKey)setViewedKey(latest.savedKey);}};channel.current=connection;}
  const url=new URL(window.location.href);url.searchParams.delete('preview');url.searchParams.set('homepagePreview',previewToken.current);
  const popup=window.open(url.href,'academy-homepage-preview-'+previewToken.current);if(popup){popup.opener=null;setError('');}else setError('プレビューを開けませんでした。このサイトのポップアップを許可して、もう一度お試しください。');
 }
 async function markReviewed(){if(dirty||saving||!hasSavedPreview||!front?.homepage_revision||reviewing)return;setReviewing(true);setError('');try{const result=await api.review(headquartersId,front.homepage_revision);if(result.currentRevision!==front.homepage_revision||!result.reviewed)throw Error('最新の保存内容の確認を記録できませんでした。');setReviewedRevision(result.reviewedRevision);setPreparationError('');setNotice('ホームページの準備ができました。続いて講座を作成しましょう。');}catch(cause){setError(cause instanceof Error?cause.message:'確認を記録できませんでした。');}finally{setReviewing(false);}}
 function visibilityToggle(key:'name'|'logo'|'tagline',label:string){const available=key!=='logo'||!!identity.logo_url;return <label className={styles.visibilityToggle}><input type="checkbox" disabled={saving||!available} checked={available&&design.visibility?.[key]!==false} onChange={event=>{change();setDesign(previous=>({...previous,visibility:{name:previous.visibility?.name!==false,logo:previous.visibility?.logo!==false,tagline:previous.visibility?.tagline!==false,[key]:event.target.checked}}));}}/>{label}</label>;}
 const publicPath='/academy/site/'+encodeURIComponent(preferredHandle??front.handle);
 return <div className={styles.wrap}>
  <div className={styles.heading}><div><span>HOMEPAGE</span><h1>ホームページ</h1></div><div className={styles.actions}><Link href={href('/academy')}>本部ホームへ</Link></div></div>
  {guided&&<section className={styles.card+' '+styles.setupGuide}><nav aria-label="はじめての設定"><span>本部設定 ✓</span><strong aria-current="step">ホームページ</strong><span>講座・販売プラン</span><span>募集開始</span></nav><h2>ホームページをつくりましょう</h2><p>本部設定の内容を引き継いでいます。URLや画像、紹介文を整えて保存してください。公開はあとからでもできます。</p><Link href={href('/academy/settings?onboarding=1')}>本部設定へ戻る</Link></section>}<section className={styles.publicLocation}><span>ホームページURL</span><code>{publicPath}</code><button type="button" onClick={()=>{void navigator.clipboard.writeText(new URL(publicPath,window.location.origin).href).then(()=>setNotice('URLをコピーしました。')).catch(()=>setError('URLをコピーできませんでした。表示されているURLをご利用ください。'));}}>URLをコピー</button>{front.publicly_available?<a href={publicPath} target="_blank" rel="noopener noreferrer">公開中のページを開く</a>:<span>現在は未公開です</span>}</section>
  {(api===defaultApi||api.url)&&<details className={styles.card} open={urlOpen} onToggle={event=>setUrlOpen(event.currentTarget.open)}><summary>{urlOpen?'ホームページのURLを決めましょう':'ホームページのURL設定'}</summary><HomepageUrlSettings oneTime headquartersId={headquartersId} api={api.url} disabled={dirty||saving} onChanged={value=>{setPreferredHandle(value.preferredHandle);setUrlOpen(false);setNotice('URL名を保存しました。以前のURLも使えます。');}}/></details>}
  {preparationError&&<p role="status" className={styles.note}>{preparationError} <button type="button" onClick={()=>setRetry(value=>value+1)}>再確認</button></p>}

   <nav className={styles.tabs} aria-label="ホームページの編集場所"><button aria-current={area==='settings'?'page':undefined} onClick={()=>setArea('settings')}>ホームページ設定</button><button aria-current={area==='body'?'page':undefined} onClick={()=>setArea('body')}>ホームページを編集</button></nav>
   {area==='settings'?<section className={styles.card} aria-label="ホームページ設定"><h2>ホームページ設定</h2><div className={styles.fields}>
    <div className={styles.identityField}><label>本部・教室名 必須<input maxLength={100} readOnly={!front.can_edit_identity} disabled={saving} value={identity.name} onChange={event=>editIdentity({name:event.target.value})}/></label>{visibilityToggle('name','教室名を表示')}</div>
    <div className={styles.identityField}><label>キャッチコピー<input maxLength={4000} readOnly={!front.can_edit_identity} disabled={saving} value={identity.tagline} onChange={event=>editIdentity({tagline:event.target.value})}/></label>{visibilityToggle('tagline','キャッチコピーを表示')}</div>
    <p className={styles.note}>ホームページの内容を整えます。</p>
    <label className={styles.full}>紹介文<textarea rows={5} value={message} disabled={saving} onChange={event=>{change();setMessage(event.target.value);}}/></label>
    <div className={styles.imageSetting} data-image-setting="hero"><header className={styles.imageSettingHeading}><h3>メイン画像</h3></header>{front.can_edit_identity&&!saving?<ImagePicker compact currentUrl={identity.hero_image_url??undefined} onUploaded={url=>editIdentity({hero_image_url:url})}/>:identity.hero_image_url?<img className={styles.image} src={identity.hero_image_url} alt="ホームページのメイン画像"/>:<p className={styles.note}>未設定</p>}{front.can_edit_identity&&identity.hero_image_url&&<button type="button" disabled={saving} onClick={()=>editIdentity({hero_image_url:null})}>画像を外す</button>}</div>
    <div className={styles.imageSetting} data-image-setting="logo"><header className={styles.imageSettingHeading}><h3>ロゴ</h3>{visibilityToggle('logo','ロゴを表示')}</header>{front.can_edit_identity&&!saving?<ImagePicker compact currentUrl={identity.logo_url??undefined} onUploaded={url=>editIdentity({logo_url:url})}/>:identity.logo_url?<img className={styles.logo} src={identity.logo_url} alt="ホームページのロゴ"/>:<p className={styles.note}>未設定</p>}{front.can_edit_identity&&identity.logo_url&&<button type="button" disabled={saving} onClick={()=>editIdentity({logo_url:null})}>ロゴを外す</button>}</div>
   </div><AcademyFrontDesignEditor ImagePicker={ImagePicker} homepageLabels design={design} title={identity.tagline} message={message} imageUrl={identity.hero_image_url??''} onChange={value=>{change();setDesign(value);}}/>
   </section>:<section className={styles.editor} data-hide-library={hideLibrary} data-hide-inspector={hideInspector}><div className={styles.sidebarControls}><button type="button" aria-expanded={!hideLibrary} onClick={()=>setHideLibrary(value=>!value)}>構成欄を{hideLibrary?'開く':'畳む'}</button><button type="button" aria-expanded={!hideInspector} onClick={()=>setHideInspector(value=>!value)}>編集欄を{hideInspector?'開く':'畳む'}</button></div><AcademyLpEditor ImagePicker={BodyImagePicker} desktopViewportWidth={typeof frontMaxWidth(design)==='number'?frontMaxWidth(design) as number:1440} onPreview={openLivePreview} title={identity.name} blocks={blocks} previewMaxWidth={frontMaxWidth(design)} onChange={value=>{change();setBlocks(value);}} renderPage={(items,context)=><div onClickCapture={event=>{if(event.target instanceof Element&&event.target.closest('a'))event.preventDefault();}}><HeadquartersHomepagePresentation decorateFixed={(title,content)=><FixedPageRegion title={title} onEdit={title==='ヘッダー'||title==='教室の紹介・画像'?()=>setArea('settings'):undefined}>{content}</FixedPageRegion>} front={{...projection,front_blocks:writeFrontDocument(saveAcademyLpContent(blocks,items),design)}} courses={publicContent?.courses??[]} instructors={publicContent?.instructors??[]} publicOfferings={publicContent?.offerings??undefined} publishedPages={publishedPages} renderBody={()=> <EditablePageRegion empty={!items.length} onAdd={()=>context.insert(0)}><LpContent honorVisibility={context.reading} minimumFontSize={14} standaloneButtons blocks={items} render={context.renderContent} decorate={context.reading?undefined:context.decorate}/></EditablePageRegion>}/></div>}/></section>}
  <footer className={styles.savebar}><p className={styles.note}>ホームページ：{front.publicly_available?'公開中':front.publication_state==='hidden'?'非公開':'未公開'}</p><div className={styles.saveControls}>{guided?<Link className={styles.link} href={href('/academy/settings?onboarding=1')}>戻る</Link>:<Link className={styles.link} href={href('/academy')}>本部ホームへ</Link>}<div><button type="button" className={styles.primary} disabled={!dirty||saving} onClick={()=>void save()}>{saving?'保存中…':'保存する'}</button><p role="status">{saving?'保存中…':dirty?'変更を保存してください':notice==='保存しました'?'保存しました':'保存済みです'}</p></div></div><div className={styles.publishControls}><button type="button" onClick={openLivePreview}>プレビュー</button><button type="button" className={styles.primary} disabled={saving||dirty||!front.homepage_revision} onClick={()=>setConfirm('publish')}>{front.publicly_available?'公開内容を更新する':front.publication_state==='hidden'?'ホームページを再公開する':'ホームページを公開する'}</button>{front.publicly_available&&<button type="button" disabled={saving||dirty} onClick={()=>setConfirm('hide')}>非公開にする</button>}</div>{notice&&<p role="status" className={styles.feedback}>{notice}</p>}{error&&<p role="alert" className={styles.error}>{error}</p>}{guided&&<section className={styles.reviewState} style={{marginTop:20}}><p>{front.publicly_available?'ホームページを公開しました。続いて、新しい講座をつくりましょう。':'ホームページは公開せずに、新しい講座を作成できます。'}</p>{dirty?<p>先に変更を保存してください。</p>:onContinue?<button type="button" disabled={saving||!front.homepage_revision} className={styles.primary} onClick={onContinue}>{front.publicly_available?'新しく講座を作る':'公開せずに講座を作る'}</button>:<Link className={styles.primary} href={href('/academy/create?entry=new&tab=course')}>{front.publicly_available?'新しく講座を作る':'公開せずに講座を作る'}</Link>}</section>}</footer>
  <dialog ref={confirmation} className={styles.confirmation} onCancel={()=>setConfirm(false)} onClose={()=>setConfirm(false)}><h2>{confirm==='hide'?'ホームページを非公開にしますか？':front.publicly_available?'公開内容を更新しますか？':'ホームページを公開しますか？'}</h2><p>{confirm==='hide'?'ホームページの表示を停止します。販売プランや既存のお申し込みは維持します。':'下書き保存した内容を、お客様向けのホームページに反映します。'}</p><div className={styles.actions}><button type="button" onClick={()=>setConfirm(false)}>戻る</button><button type="button" className={styles.primary} disabled={saving} onClick={()=>void publish()}>確認して変更する</button></div></dialog>
 </div>;
}
