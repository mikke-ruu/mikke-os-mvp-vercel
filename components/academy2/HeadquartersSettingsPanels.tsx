'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {getHeadquartersSettings,saveHeadquartersBasic,saveHeadquartersDocument,type HeadquartersBasic,type HeadquartersDocumentKind,type HeadquartersSettings} from '@/lib/academy2/headquarters-settings';
import {HeadquartersStaffPanel} from './HeadquartersStaffPanel';
import type {Academy2HeadquartersContext} from '@/lib/academy2/context';
import styles from './headquarters-settings.module.css';
import {BANK_FIELDS,DEFAULT_BANK_GUIDE,emptyBankFields,formatBankNote,parseBankNote,bankNoteReady} from '@/lib/academy2/bank-note.mjs';
import {DOCUMENT_TEMPLATE_NOTICE,headquartersDocumentTemplate} from '@/lib/academy2/headquarters-document-templates';
import {AcademyNoOperatingFeeNotice} from '@/components/academy/AcademyNoOperatingFeeNotice';
import {FirstPublicationSetup} from './FirstPublicationSetup';
import {HeadquartersBrandingPanel} from './HeadquartersBrandingPanel';
import {SellerInformationPanel,type SellerPanelStatus} from './SellerInformationPanel';
import {getAcademy2OnboardingStatus} from '@/lib/academy2/onboarding';
import {getSellerProfile} from '@/lib/academy2/seller-disclosure';
import {bankExamples,newHeadquartersDocumentDraft,unfinishedTemplateFields,answerDocumentQuestions,initialDocumentAnswers,documentQuestions} from '@/lib/academy2/setup-suggestions';
import {SettingsDialog} from './SettingsDialog';
import {DocumentQuestions} from './DocumentQuestions';
import flowStyles from './document-questions-flow.module.css';
import {headquartersSetupApi,type HeadquartersSetupApi} from '@/lib/academy2/headquarters-setup-api';

const documents:{kind:HeadquartersDocumentKind;label:string;description:string}[]=[
 {kind:'cancellation',label:'キャンセル・返金ポリシー',description:'最初にキャンセル・日程変更・キットの条件を決めます'},
 {kind:'application',label:'共通申込規約',description:'入力した条件から申込規約を作ります'},
 {kind:'commerce',label:'特定商取引法に基づく表記',description:'本部販売時の販売者情報・支払条件等'},

 {kind:'privacy',label:'プライバシーポリシー',description:'受講者情報の取扱い'}
];
const date=(value:string|null|undefined)=>value?new Date(value).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'未確認';
const normalizedBasic=(value:HeadquartersBasic):HeadquartersBasic=>({name:value.name??'',contact_email:value.contact_email??'',tagline:value.tagline??'',default_payment_note:value.default_payment_note??'',updated_at:value.updated_at});

/** Content grid, card density and fields follow approved UI31. No legacy settings component is mounted. */
export type SettingsPanelStatus={busy:boolean;dirty:boolean;error:string;saved:HeadquartersSettings|null;basicSaved:boolean|null;save?:()=>Promise<boolean|void>;canSave?:boolean;message?:string;advance?:()=>boolean;canAdvance?:boolean;progressLabel?:string};
export function HeadquartersSettingsPanels({headquarters,tab,documentsOnly=false,inlineDocuments=false,footerControls=false,onStatus,api=headquartersSetupApi,previewOnly=false}:{headquarters:Academy2HeadquartersContext;tab:string;documentsOnly?:boolean;inlineDocuments?:boolean;footerControls?:boolean;onStatus?:(status:SettingsPanelStatus)=>void;api?:HeadquartersSetupApi;previewOnly?:boolean}){
 const {getSettings:getHeadquartersSettings,saveBasic:saveHeadquartersBasic,saveDocument:saveHeadquartersDocument,getSeller:getSellerProfile,getOnboarding:getAcademy2OnboardingStatus}=api;
 const [saved,setSaved]=useState<HeadquartersSettings|null>(null);
 const [basic,setBasic]=useState<HeadquartersBasic|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[retry,setRetry]=useState(0);
 const [editing,setEditing]=useState<HeadquartersDocumentKind|null>(null),[version,setVersion]=useState(''),[body,setBody]=useState(''),[revision,setRevision]=useState(0);
 const documentRequest=useRef<{signature:string;version:string}|null>(null);
 const [documentConflict,setDocumentConflict]=useState(false),[latestDocuments,setLatestDocuments]=useState<HeadquartersSettings|null>(null),[messageScope,setMessageScope]=useState('');
 const [structuredBank,setStructuredBank]=useState(false);
 const [basicMutationStamp,setBasicMutationStamp]=useState<string|null>(null);
 const [basicSaved,setBasicSaved]=useState<boolean|null>(null);
 const [documentPreview,setDocumentPreview]=useState(false);
 const [answers,setAnswers]=useState<Record<string,string>>({}),[answersDirty,setAnswersDirty]=useState(false);
 const [questionBody,setQuestionBody]=useState('');
 const [sellerStatus,setSellerStatus]=useState<SellerPanelStatus|null>(null);
 useEffect(()=>{if(tab!=="規約・契約")setSellerStatus(null);},[tab]);
 const canEdit=headquarters.role==='administrator';
 useEffect(()=>{let live=true;setBasicSaved(null);getAcademy2OnboardingStatus(headquarters.id).then(value=>{if(live)setBasicSaved(value.basicSaved);}).catch(()=>{/* An uncertain initial state does not enable an unchanged save. */});return()=>{live=false;};},[headquarters.id,retry]);
 const basicDirty=!!basic&&!!saved&&(['name','contact_email','tagline'] as const).some(key=>basic[key]!==saved.basic[key]);
 const paymentDirty=!!basic&&!!saved&&basic.default_payment_note!==saved.basic.default_payment_note;
 const dirty=basicDirty||paymentDirty;
 const docDirty=canEdit&&!!editing&&(answersDirty||version!==(saved?.documents.find(item=>item.kind===editing)?.version??'')||body!==(saved?.documents.find(item=>item.kind===editing)?.body??''));
 const footerActions=useRef<{save?:()=>Promise<boolean|void>;advance?:()=>boolean}>({});
 const saveFromFooter=useCallback(async()=>await footerActions.current.save?.(),[]);
 const advanceFromFooter=useCallback(()=>footerActions.current.advance?.()??true,[]);
 const automaticDocument=useRef('');
 useEffect(()=>{let current=true;setBusy(true);setError('');setSaved(null);setBasic(null);setEditing(null);getHeadquartersSettings(headquarters.id).then(value=>{if(current){const normalized={...value,basic:normalizedBasic(value.basic)};setSaved(normalized);setBasic(normalized.basic);}}).catch(cause=>{if(current)setError(cause.message);}).finally(()=>{if(current)setBusy(false);});return()=>{current=false;};},[headquarters.id,retry]);
 useEffect(()=>{if(!dirty&&!docDirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty,docDirty]);
 async function saveBasic(section:'basic'|'payment'){
  if(!basic||!saved||busy)return false;
  const canonical=normalizedBasic(saved.basic),draft=normalizedBasic(basic);
  const input=section==='payment'?{...canonical,default_payment_note:draft.default_payment_note}:{...draft,default_payment_note:canonical.default_payment_note};
  setBusy(true);setError('');setMessage('');setMessageScope(section);
  try{
   const value=await saveHeadquartersBasic(headquarters.id,input);
   const normalized={...value,basic:normalizedBasic(value.basic)};
   setSaved(normalized);
   setBasicMutationStamp(normalized.basic.updated_at);
   setBasic(section==='payment'?{...draft,default_payment_note:normalized.basic.default_payment_note,updated_at:normalized.basic.updated_at}:{...normalized.basic,default_payment_note:draft.default_payment_note});
   setMessage(previewOnly?'この確認画面に保存しました（DBには保存していません）':'保存しました');
   if(section==='basic')setBasicSaved(true);
   return true;
  }catch(cause){setError(cause instanceof Error?cause.message:'保存できませんでした。');return false;}
  finally{setBusy(false);}
 }
 async function saveDocument(){
  if(!editing||busy||documentConflict||!body.trim()||body.length>50000||unfinishedTemplateFields(body).length)return false;
  const signature=JSON.stringify([headquarters.id,editing,revision,body]);
  if(documentRequest.current?.signature!==signature)documentRequest.current={signature,version:'hq-'+editing+'-'+crypto.randomUUID()};
  setBusy(true);setError('');setMessage('');setMessageScope('document');
  try{const value=await saveHeadquartersDocument(headquarters.id,editing,revision,documentRequest.current.version,body);const doc=value.documents.find(item=>item.kind===editing);if(!doc||doc.body!==body||doc.revision!==revision+1||doc.version!==documentRequest.current.version)throw new Error('規約の保存結果を確認できませんでした。入力内容は残っています。');setSaved(value);setRevision(doc.revision);setVersion(doc.version);setAnswersDirty(false);documentRequest.current=null;setMessage(previewOnly?'この確認画面に保存しました（DBには保存していません）':'保存しました');return true;}
  catch(cause){setError(cause instanceof Error?cause.message:'保存できませんでした。入力内容は残っています。');setDocumentConflict((cause as {code?:string})?.code==='PT409');return false;}
  finally{setBusy(false);}
 }
 async function checkLatestDocument(){setBusy(true);setError('');try{setLatestDocuments(await getHeadquartersSettings(headquarters.id));}catch(cause){setError(cause instanceof Error?cause.message:'最新の本文を確認できませんでした。');}finally{setBusy(false);}}
 function useLatestDocument(keepDraft:boolean){if(!latestDocuments||!editing)return;const doc=latestDocuments.documents.find(item=>item.kind===editing);setSaved(prev=>prev?{...prev,documents:latestDocuments.documents}:latestDocuments);setRevision(doc?.revision??0);setVersion(doc?.version??'');if(!keepDraft){const latestBody=doc?.body??headquartersDocumentTemplate(editing);setBody(latestBody);setQuestionBody(latestBody);setAnswers({});setAnswersDirty(false);}documentRequest.current=null;setLatestDocuments(null);setDocumentConflict(false);setError('');setMessage('');}
 async function editDocument(kind:HeadquartersDocumentKind){
  if(busy||!saved)return;if(docDirty&&!window.confirm('編集中の規約は未保存です。別の規約を開きますか？'))return;
  const value=saved.documents.find(item=>item.kind===kind);let draft=value?.body;
  if(draft===undefined){setBusy(true);setError('');setMessageScope('document');try{const [seller,payment]=await Promise.all([getSellerProfile(headquarters.id),kind==='application'||kind==='commerce'?api.getBankPreference(headquarters.id):Promise.resolve(undefined)]);draft=newHeadquartersDocumentDraft(kind,saved,seller.document,payment);}catch{setError('保存済みの情報を読み込めませんでした。もう一度文書を開いてください。');return;}finally{setBusy(false);}}
  const suggested=value?{}:initialDocumentAnswers(draft);
  setAnswers(suggested);setAnswersDirty(false);setQuestionBody(draft);setDocumentPreview(false);setEditing(kind);setVersion(value?.version??'');setBody(answerDocumentQuestions(draft,suggested));setRevision(value?.revision??0);setMessage('');setError('');setDocumentConflict(false);setLatestDocuments(null);documentRequest.current=null;
 }
 function closeDocument(){if(busy)return;if(docDirty&&!window.confirm('保存していない本文を閉じますか？'))return;setEditing(null);setDocumentPreview(false);}
 const bankIsStructured=structuredBank||!!parseBankNote(basic?.default_payment_note??'')||!basic?.default_payment_note.trim();
 const basicCanSave=!!basic&&canEdit&&!busy&&!!basic.name.trim()&&(basicDirty||basicSaved===false);
 const paymentCanSave=!!basic&&canEdit&&!busy&&paymentDirty&&(!bankIsStructured||bankNoteReady(basic.default_payment_note));
 const documentCanSave=canEdit&&!busy&&!!editing&&docDirty&&!!body.trim()&&body.length<=50000&&!unfinishedTemplateFields(body).length&&!documentConflict;
 const currentDocument=saved?.documents.find(item=>item.kind===editing);
 const documentCanAdvance=!!editing&&!busy&&!docDirty&&!documentConflict&&!!currentDocument&&currentDocument.revision>0&&!!currentDocument.version?.trim()&&!!currentDocument.body?.trim()&&!unfinishedTemplateFields(currentDocument.body).length;
 const documentIndex=documents.findIndex(item=>item.kind===editing);
 footerActions.current={save:()=>tab==='支払'?saveBasic('payment'):tab==='規約・契約'?saveDocument():saveBasic('basic'),advance:()=>{if(tab!=='規約・契約')return true;if(!documentCanAdvance)return false;if(documentIndex<documents.length-1){void editDocument(documents[documentIndex+1].kind);return false;}return true;}};
 const progressLabel=tab==='規約・契約'&&editing?`規約 ${documentIndex+1} / ${documents.length}　${documents[documentIndex].label}`:undefined;
 const footerMessage=messageScope===(tab==='支払'?'payment':tab==='規約・契約'?'document':'basic')?message:'';
 const footerCanSave=tab==='支払'?paymentCanSave:tab==='規約・契約'?documentCanSave:basicCanSave;
 const footerCanAdvance=tab==='規約・契約'?documentCanAdvance:!busy&&!dirty&&!error;
 useEffect(()=>{onStatus?.({busy:busy||!!sellerStatus?.busy,dirty:dirty||docDirty||!!sellerStatus?.dirty,error:error||sellerStatus?.error||'',saved,basicSaved,save:saveFromFooter,canSave:footerCanSave,message:footerMessage,advance:advanceFromFooter,canAdvance:footerCanAdvance,progressLabel});},[busy,dirty,docDirty,error,saved,basicSaved,onStatus,sellerStatus,saveFromFooter,footerCanSave,footerMessage,advanceFromFooter,footerCanAdvance,progressLabel]);
 useEffect(()=>{if(tab!=='規約・契約'||!inlineDocuments){automaticDocument.current='';return;}const key=headquarters.id+':documents';if(saved&&!busy&&!editing&&automaticDocument.current!==key){automaticDocument.current=key;void editDocument('cancellation');}},[tab,inlineDocuments,headquarters.id,saved,busy,editing]);
 if(!saved||!basic)return <div className={styles.note}>{busy?<p role="status">本部設定を読み込んでいます…</p>:<><p role="alert">{error}</p><button className={styles.btn} onClick={()=>setRetry(value=>value+1)}>再読み込み</button></>}</div>;
 const parsedBank=parseBankNote(basic.default_payment_note),bankFields=parsedBank?.fields??emptyBankFields(),bankGuide=parsedBank?.guide??(basic.default_payment_note||DEFAULT_BANK_GUIDE),bankMode=structuredBank||!!parsedBank||!basic.default_payment_note.trim();
 const updateBank=(fields:Record<string,string>,guide:string)=>{setBasic({...basic,default_payment_note:formatBankNote(fields,guide)});setMessage('');};
 const feedback=(scope:string)=>footerControls?null:<div aria-live="polite">{messageScope===scope&&message&&<p className={styles.help} role="status">{message}</p>}{messageScope===scope&&error&&<p className={styles.error} role="alert">{error}</p>}</div>;
 const documentContent=editing&&<div className={styles.dialogBody}>
 <p className={styles.help}>{DOCUMENT_TEMPLATE_NOTICE}</p>
 {footerControls&&<nav className={flowStyles.steps} aria-label="規約の順番">{documents.map((item,index)=><button type="button" key={item.kind} disabled={busy} aria-current={editing===item.kind?'step':undefined} onClick={()=>void editDocument(item.kind)}><span>{index+1}</span>{item.label}</button>)}</nav>}
 {documentQuestions(questionBody).length>0?<DocumentQuestions body={questionBody} answers={answers} disabled={busy||!canEdit} onChange={value=>{setAnswers(value);setBody(answerDocumentQuestions(questionBody,value));setAnswersDirty(true);setMessage('');}}/>:<p className={styles.help}>入力済みの情報を反映しました。プレビューで確認して保存してください。</p>}
 <details key={editing} className={flowStyles.directEdit}><summary>文章を直接編集する</summary><label>本文<textarea aria-label="規約本文を直接編集" value={body} disabled={!canEdit||busy} maxLength={50000} rows={12} onChange={event=>{setBody(event.target.value);setQuestionBody(event.target.value);setAnswers({});setAnswersDirty(false);setMessage('');}}/></label></details>
 <div className={flowStyles.preview}><button type="button" className={styles.btn} aria-expanded={documentPreview} aria-controls={'document-preview-'+editing} onClick={()=>setDocumentPreview(value=>!value)}>プレビュー</button>{documentPreview&&<article id={'document-preview-'+editing} className={styles.documentPreview} aria-label="規約のプレビュー"><pre>{body}</pre></article>}</div>
 {feedback('document')}
 {documentConflict&&<button className={styles.btn} disabled={busy} onClick={()=>void checkLatestDocument()}>最新の保存状態を確認</button>}
 {latestDocuments&&<div className={styles.note}><h3>最新の保存済み本文</h3><pre>{latestDocuments.documents.find(item=>item.kind===editing)?.body??'保存済みの本文はありません。'}</pre><div className={styles.actions}><button className={styles.btn} onClick={()=>useLatestDocument(false)}>最新の本文を使う</button><button className={styles.btn} onClick={()=>useLatestDocument(true)}>編集中の本文を残す</button></div></div>}
 </div>;
 const documentFooter=<footer className={styles.dialogFooter}><span className={styles.help}>{revision?'保存済み':'未保存のひな形'}</span><button className={styles.btn+' '+styles.orange} disabled={!documentCanSave} onClick={()=>void saveDocument()}>{busy&&messageScope==='document'?'保存中…':'保存する'}</button></footer>;
 return <>
 {tab==='本部情報'&&<section className={styles.card}><h2>基本情報</h2><p className={styles.help}>本部の基本情報を登録します。</p><p className={styles.help}>本部の紹介はホームページにも表示されます。</p>
  <div className={styles.grid2}>{(['name','contact_email'] as const).map(key=><div className={styles.field} key={key}><label>{key==='name'?<>本部名 <span className={styles.required}>必須</span>{!basic.name.trim()&&<small className={styles.help}> 入力してください</small>}</>:'メールアドレス（問い合わせ用）'}<input type={key==='contact_email'?'email':'text'} maxLength={key==='name'?100:320} required={key==='name'} disabled={!canEdit||busy} value={basic[key]} onChange={event=>{setBasic({...basic,[key]:event.target.value});setMessage('');}}/></label></div>)}</div>
  <div className={styles.field}><label>本部の紹介<textarea maxLength={4000} disabled={!canEdit||busy} value={basic.tagline} onChange={event=>{setBasic({...basic,tagline:event.target.value});setMessage('');}}/></label></div>
  <div className={styles.actions} hidden={footerControls} style={footerControls?{display:'none'}:undefined}><button className={styles.btn+' '+styles.orange} disabled={!canEdit||busy||!basic.name.trim()||(!basicDirty&&basicSaved!==false)} onClick={()=>void saveBasic('basic')}>{busy&&messageScope==='basic'?'保存中…':'保存する'}</button></div>{feedback('basic')}
  {basicDirty&&!footerControls&&<p className={styles.help}>未保存の変更があります。</p>}
 </section>}
 {!previewOnly&&tab==='本部情報'&&api===headquartersSetupApi&&<div className={styles.brandingBlock}><HeadquartersBrandingPanel basicSavedAt={basicMutationStamp} onSaved={value=>{setSaved(prev=>prev?{...prev,basic:{...prev.basic,updated_at:value.updated_at}}:prev);setBasic(prev=>prev?{...prev,updated_at:value.updated_at}:prev);}} headquartersId={headquarters.id} canEdit={headquarters.role==='owner'||canEdit}/></div>}
 {tab==='支払'&&<section className={styles.card}><h2>お支払い方法</h2><p className={styles.help}>受講料のお支払い方法を設定します。</p>
 <div className={styles.method}><div className={styles.methodHead}><h3>銀行振込</h3><span className={styles.status}>{saved.basic.default_payment_note.trim()?'案内を設定済み':'案内は未設定'}</span></div>
 {bankMode?<><h4>銀行振込先</h4><div className={styles.grid2}>{BANK_FIELDS.map(field=><div key={field.key} className={styles.field}><label>{field.label} <span className={styles.required}>必須</span>{field.key==='type'?<select value={bankFields.type} disabled={!canEdit||busy} onChange={e=>updateBank({...bankFields,type:e.target.value},bankGuide)}><option value="">選択してください</option>{['普通','当座','貯蓄'].map(value=><option key={value} value={value}>{value}</option>)}{bankFields.type&&!['普通','当座','貯蓄'].includes(bankFields.type)&&<option value={bankFields.type}>{bankFields.type}（保存済み）</option>}</select>:<input value={bankFields[field.key]} placeholder={bankExamples[field.key]} inputMode={field.key==='number'?'numeric':undefined} disabled={!canEdit||busy} maxLength={120} onChange={e=>updateBank({...bankFields,[field.key]:e.target.value},bankGuide)}/>}</label></div>)}</div>
 <div className={styles.field}><label>お客様へのご案内文<textarea value={bankGuide} disabled={!canEdit||busy} maxLength={3000} onChange={e=>updateBank(bankFields,e.target.value)}/></label></div></>:<><div className={styles.field}><label>これまでの振込案内<textarea maxLength={4000} disabled={!canEdit||busy} value={basic.default_payment_note} onChange={event=>{setBasic({...basic,default_payment_note:event.target.value});setMessage('');}}/></label></div><p className={styles.help}>以前の案内をそのまま保持しています。項目別に入力する場合も、この文章は案内文に残ります。</p><button className={styles.btn} type="button" disabled={!canEdit||busy} onClick={()=>setStructuredBank(true)}>振込先を項目ごとに入力する</button></>}
 <details className={styles.preview}><summary>振込案内をプレビュー</summary><pre>{bankMode?formatBankNote(bankFields,bankGuide):basic.default_payment_note}</pre></details>
 <p className={styles.help}>保存した振込先と案内文を、申込時の振込案内として使用します。メール配信の確認は別途必要です。</p>
 {bankMode&&paymentDirty&&!bankNoteReady(basic.default_payment_note)&&<p className={styles.help}>振込先の5項目を入力してください。案内全体は4,000文字以内で保存します。</p>}
 <div className={styles.actions} hidden={footerControls} style={footerControls?{display:'none'}:undefined}><button className={styles.btn+' '+styles.orange} disabled={!canEdit||busy||!paymentDirty||(bankMode&&!bankNoteReady(basic.default_payment_note))} onClick={()=>void saveBasic('payment')}>{busy&&messageScope==='payment'?'保存中…':'保存する'}</button></div>{feedback('payment')}
 </div>
 {!documentsOnly&&<div className={styles.method}><div className={styles.methodHead}><h3>カード決済</h3><span className={styles.status}>{saved.connect?.ready?'接続確認済み':saved.connect?'接続の確認が必要':'未接続'}</span></div><p className={styles.help}>Stripe Connectの接続状態を表示します。カード決済の受付開始を示すものではありません。</p>{saved.connect&&<p className={styles.help}>決済接続：{saved.connect.charges_enabled?'有効':'確認が必要'} ／ 送金接続：{saved.connect.payouts_enabled?'有効':'確認が必要'}<br/>確認日時：{date(saved.connect.verified_at)}</p>}<div className={styles.actions}><button className={styles.btn} disabled={busy||dirty||docDirty} onClick={()=>setRetry(value=>value+1)}>接続状態を確認</button></div><p className={styles.help}>この画面では登録・変更を行いません。</p></div>}</section>}
 {tab==='規約・契約'&&<><div hidden={inlineDocuments&&!!editing}>{!documentsOnly&&<SellerInformationPanel headquartersId={headquarters.id} onStatus={setSellerStatus} policyRevision={saved.documents.filter(doc=>['cancellation','privacy','commerce'].includes(doc.kind)).map(doc=>doc.kind+':'+doc.revision).join(',')}/>}<section className={styles.card}><h2>規約・契約</h2><p className={styles.help}>販売者情報と回答から4つの文書を用意します。まずキャンセル条件を保存すると、ほかの新しい文書にも入ります。</p><div className={styles.templateList}>{documents.map(item=><div className={styles.templateRow} key={item.kind}><div><strong>{item.label}</strong><p>{item.description} ／ {saved.documents.find(doc=>doc.kind===item.kind)?'保存履歴 '+saved.documents.find(doc=>doc.kind===item.kind)!.revision+'版':'未保存'}</p></div><button className={styles.btn} disabled={busy} aria-label={`${item.label}を${canEdit?'編集':'確認'}`} onClick={()=>editDocument(item.kind)}>{canEdit?'編集':'内容を見る'}</button></div>)}</div><p className={styles.note}>保存した規約は、過去のお申し込みには適用されません。販売プランには自動で反映されません。</p></section>
 </div>{!editing&&feedback("document")}
 {editing&&(footerControls?<section className={flowStyles.document} aria-label={documents.find(item=>item.kind===editing)?.label}><h2>{documents.find(item=>item.kind===editing)?.label}</h2>{documentContent}</section>:<SettingsDialog inline={inlineDocuments} title={documents.find(item=>item.kind===editing)?.label??'規約の編集'} onClose={closeDocument} closeDisabled={busy} wide>{documentContent}{documentFooter}</SettingsDialog>)}</>}
 {tab==='役割・権限'&&<HeadquartersStaffPanel headquartersId={headquarters.id} headquartersName={headquarters.name}/>}
 {tab==='利用料金'&&saved.operating_fee_state==='no_operating_fee'&&<AcademyNoOperatingFeeNotice/>}
 {tab==='利用料金'&&saved.operating_fee_state!=='no_operating_fee'&&<section className={styles.card}><h2>Academy利用料金</h2><p className={styles.help}>現行の料金計算・人数計算を維持します。</p>{saved.billing?<><div className={styles.summaryRow}><div className={styles.summaryBox}><b>現行料金表の見積</b><span>{saved.billing.estimate? saved.billing.estimate.catalog_price_yen.toLocaleString('ja-JP')+'円':'確認が必要'}</span></div><div className={styles.summaryBox}><b>課金対象の講師</b><span>{saved.billing.estimate? saved.billing.estimate.registered_instructor_count+'名':'確認が必要'}</span></div><div className={styles.summaryBox}><b>利用状態</b><span>{saved.billing.access?({active:'利用中',trialing:'体験利用中',expired:'期間終了',cancelled:'終了',past_due:'支払い確認中'}[saved.billing.access.status]??'確認が必要'):'確認が必要'}</span></div></div><p className={styles.note}>既存の料金計算が確認できた場合に見積を表示します。割引・既存契約・請求済み金額を変更するものではありません。契約・支払い手続きへの接続は準備中です。</p>{saved.billing.access?.trial_ends_at&&<p className={styles.help}>無料期間の終了：{date(saved.billing.access.trial_ends_at)}</p>}</>:<p className={styles.note}>利用料金と契約は本部責任者が確認します。</p>}<a className={styles.linkRow} href="/legal/academy/billing/2026-09-04-v1" target="_blank" rel="noreferrer">料金・支払い条件を見る</a></section>}
 {tab==='利用料金'&&headquarters.role==='owner'&&saved.operating_fee_state!=='no_operating_fee'&&<FirstPublicationSetup headquartersId={headquarters.id}/>}
 {['お知らせ','Community'].includes(tab)&&<section className={styles.card}><h2>{tab}</h2><p className={styles.note}>この設定の保存・連携は準備中です。</p></section>}
 {tab==='役割・権限'&&feedback('invite')}
 </>;
}
