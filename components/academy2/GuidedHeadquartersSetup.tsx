'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import type {Academy2HeadquartersContext} from '@/lib/academy2/context';
import {headquartersSetupApi,type HeadquartersSetupApi} from '@/lib/academy2/headquarters-setup-api';
import {readSetupSnapshot,setupProgress,type SetupSnapshot} from '@/lib/academy2/setup-progress';
import {bankNoteReady} from '@/lib/academy2/bank-note.mjs';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import {HeadquartersSettingsPanels,type SettingsPanelStatus} from './HeadquartersSettingsPanels';
import {SellerInformationPanel,type SellerPanelStatus} from './SellerInformationPanel';
import {SettingsDialog} from './SettingsDialog';
import styles from './headquarters-settings.module.css';
import ux from './guided-setup.module.css';
const steps=['本部情報','販売者情報','お支払い','規約','保存内容の確認'];
export function GuidedHeadquartersSetup({headquarters,onClose,api=headquartersSetupApi,previewOnly=false,onCreate}:{headquarters:Academy2HeadquartersContext;onClose:()=>void;api?:HeadquartersSetupApi;previewOnly?:boolean;onCreate?:()=>void}){
 const router=useRouter();const [step,setStep]=useState(0),[snapshot,setSnapshot]=useState<SetupSnapshot|null>(null),[error,setError]=useState(''),[checking,setChecking]=useState(true),[started,setStarted]=useState(false);
 const [panel,setPanel]=useState<SettingsPanelStatus|null>(null),[seller,setSeller]=useState<SellerPanelStatus|null>(null);
 const [bankChoice,setBankChoice]=useState<boolean|null>(null),[saving,setSaving]=useState(false),[panelKey,setPanelKey]=useState(0),[feedback,setFeedback]=useState('');const inFlight=useRef(false);
 const needsPanel=step<4&&step!==1&&!(step===2&&bankChoice!==true);
 const active=step===1?seller:needsPanel?panel:null;
 const bankDirty=step===2&&!!snapshot&&bankChoice!==snapshot.bank.useBank;
 const dirty=!!active?.dirty||bankDirty;
 const busy=checking||saving||!!active?.busy||step<4&&(step===1?seller===null:needsPanel&&panel===null);
 const progress=snapshot?setupProgress(snapshot):null;
 async function refresh(){setChecking(true);setError('');try{const value=await readSetupSnapshot(api,headquarters.id);setSnapshot(value);return value;}catch{setError('保存内容を確認できませんでした。入力は残っています。');return null;}finally{setChecking(false);}}
 useEffect(()=>{let live=true;void readSetupSnapshot(api,headquarters.id).then(value=>{if(!live)return;setSnapshot(value);setBankChoice(value.bank.useBank);setStep(setupProgress(value).firstIncomplete);setStarted(true);}).catch(()=>{if(live)setError('設定状況を確認できませんでした。');}).finally(()=>{if(live)setChecking(false);});return()=>{live=false;};},[api,headquarters.id]);
 useEffect(()=>{if(dirty)setFeedback('');},[dirty]);
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 function close(){if(busy)return;if(dirty&&!window.confirm('保存していない入力があります。閉じますか？'))return;onClose();}
 function move(next:number){setPanel(null);setSeller(null);setFeedback('');setError('');setStep(next);setPanelKey(v=>v+1);}
 async function saveCurrent(){if(inFlight.current||busy||!snapshot)return;inFlight.current=true;setSaving(true);setError('');setFeedback('');try{
  if(step===2){if(bankChoice===null)return;if(bankChoice===true){if(active?.dirty){if(!active.canSave||!active.save)return;if(await active.save()===false)return;}const settings=await api.getSettings(headquarters.id);if(!bankNoteReady(settings.basic.default_payment_note)){setError('振込先の必須項目を入力してください。');return;}}
   if(bankChoice!==snapshot.bank.useBank){const result=await api.saveBankPreference(headquarters.id,snapshot.bank.revision,bankChoice);const verified=await api.getBankPreference(headquarters.id);if(result.revision!==verified.revision||verified.useBank!==bankChoice)throw Error('保存結果を確認できませんでした。再送せず、保存状態を確認してください。');}
  }else{if(!active?.canSave||!active.save)return;await active.save();}
  const value=await refresh();if(value){setBankChoice(value.bank.useBank);if(step===2)setFeedback('保存しました');}
 }catch(cause){setError(cause instanceof Error?cause.message:'保存できませんでした。入力は残っています。');}finally{inFlight.current=false;setSaving(false);}}
 const rowComplete=!!progress&&progress.rows.filter(row=>row.step===step).every(row=>row.done);
 const canNext=step===3?panel?.canAdvance===true:rowComplete;
 async function next(){if(dirty||busy||!canNext)return;if(step===3&&panel?.advance&&!panel.advance())return;const value=await refresh();if(value)move(Math.min(4,step+1));}
 function create(){if(!progress?.complete||dirty||busy)return;if(onCreate){onClose();onCreate();return;}onClose();router.push(toAcademyContextHref('/academy/front?setup=1',headquarters.id,'manage'));}
 const canSave=step===2?bankChoice!==null&&(bankDirty||!!active?.canSave)&&!(bankChoice===true&&active?.dirty&&!active.canSave):!!active?.canSave;
 const saveMessage=feedback||(active?.message?.includes('保存しました')?'保存しました':active?.message)||'';
 return <SettingsDialog title={step===4&&progress?.complete?'本部の初期設定が完了しました！':'本部の初期設定'} onClose={close} closeDisabled={busy} wide>
 <ol className={styles.setupSteps} aria-label="本部設定の順番">{steps.map((label,index)=><li key={label} aria-current={step===index?'step':undefined}><span>{index+1}</span>{label}</li>)}</ol>
 <div className={styles.dialogBody}>{previewOnly&&<p className={styles.note}>画面確認用です。入力はこの画面にだけ保存されます。</p>}{checking&&<p role="status">保存内容を確認しています…</p>}{error&&<p className={styles.error} role="alert">{error}<button className={styles.btn} onClick={()=>void refresh()}>保存状態を確認</button></p>}
 {started&&step<4&&<><p className={ux.progress}>本部設定 {step+1} / 5　{steps[step]}{step===3&&panel?.progressLabel&&<span> — {panel.progressLabel}</span>}</p>
 {step===2&&<section className={styles.card}><h2>受講料を銀行振込で受け取りますか？</h2><p className={styles.help}>ここでは振込先を登録します。外部の決済サービスを使う場合は「利用しない」を選べます。</p><div className={styles.dialogSwitch}>{[true,false].map(value=><button type="button" key={String(value)} className={styles.btn} disabled={busy} aria-pressed={bankChoice===value} onClick={()=>{if(panel?.dirty&&!window.confirm('保存していない振込先の入力を破棄しますか？'))return;setPanel(null);setPanelKey(v=>v+1);setBankChoice(value);setFeedback('');}}>{value?'利用する':'利用しない'}</button>)}</div></section>}
 {needsPanel&&<HeadquartersSettingsPanels key={step+':'+panelKey} headquarters={headquarters} tab={step===2?'支払':step===3?'規約・契約':'本部情報'} documentsOnly inlineDocuments footerControls onStatus={setPanel} api={api} previewOnly={previewOnly}/>}
 {step===1&&<SellerInformationPanel key={'seller:'+panelKey} headquartersId={headquarters.id} onStatus={setSeller} api={api} previewOnly={previewOnly} footerControls contactEmail={snapshot?.settings.basic.contact_email??''}/>}</>}
 {started&&step===4&&progress&&!checking&&!error&&<section><h2>{progress.complete?'本部の初期設定が完了しました！':'保存内容を確認しましょう'}</h2>{progress.complete&&<p>続いて、ホームページを整えて確認しましょう。</p>}<ul className={styles.setupChecklist}>{progress.rows.map(row=><li key={row.label}><span>{row.label}</span><span className={ux.completionBadge} data-done={row.done}>{row.done?'完了':'未完了'}</span><button className={styles.btn} onClick={()=>move(row.step)}>確認・変更</button></li>)}</ul><p className={styles.help}>募集の公開準備は、販売プランごとに確認します。</p></section>}
 </div><footer className={ux.footer}><div className={ux.footerSide}><button className={styles.btn} disabled={busy} onClick={step===4?close:()=>{if(step===0){close();return;}if(dirty&&!window.confirm('保存していない変更を破棄して戻りますか？'))return;move(step-1);}}>{step===4?'本部ホームへ':step===0?'後で設定する':'戻る'}</button></div>
 <div className={ux.saveFeedbackGroup}>{step<4&&<button className={styles.btn+' '+styles.orange} disabled={busy||!canSave||!started} onClick={()=>void saveCurrent()}>{saving||active?.busy?'保存中…':'保存する'}</button>}<p className={ux.saveFeedback} role="status" aria-live="polite">{saveMessage||(!canNext&&step<4&&!busy?'入力して保存してください':'')}{active?.error&&<span className={styles.error}>{active.error}</span>}</p></div>
 <div className={ux.footerSide}>{step<4?<button className={styles.btn} disabled={busy||dirty||!canNext||!!error||!started} onClick={()=>void next()}>次へ</button>:progress?.complete?<button className={styles.btn+' '+styles.orange} disabled={busy||dirty||!!error} onClick={create}>ホームページを確認する</button>:<button className={styles.btn} disabled={busy} onClick={close}>後で設定する</button>}</div></footer>
 </SettingsDialog>;
}
