'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {headquartersSetupApi,type HeadquartersSetupApi} from '@/lib/academy2/headquarters-setup-api';
import {readSetupSnapshot,setupProgress,setupLabels} from '@/lib/academy2/setup-progress';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import {getHomepagePreparation,type HomepagePreparation} from '@/lib/academy2/homepage-preparation';
import {Building2,Globe,BookOpen,CalendarDays,Check,ChevronDown} from 'lucide-react';
import styles from './setup-home-status.module.css';
export function SetupHomeStatus({headquartersId,api=headquartersSetupApi,revision=0,onOpen,onIntro,courseCreated=null,recruitment=null,readHomepage=getHomepagePreparation}:{headquartersId:string;api?:HeadquartersSetupApi;revision?:number;onOpen?:()=>void;onIntro?:()=>void;courseCreated?:boolean|null;recruitment?:boolean|null;readHomepage?:typeof getHomepagePreparation}){
 const [homepage,setHomepage]=useState<HomepagePreparation|null>(null),[homepageError,setHomepageError]=useState('');
 const [missing,setMissing]=useState<string[]>([]);
 const [state,setState]=useState<keyof typeof setupLabels|null>(null),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true,sequence=0;const read=()=>{const request=++sequence;setState(null);readSetupSnapshot(api,headquartersId).then(v=>{if(live&&request===sequence){const progress=setupProgress(v);setState(progress.state);setMissing(progress.rows.filter(row=>!row.done).map(row=>row.label));}}).catch(()=>{if(live&&request===sequence)setState('error');});};read();window.addEventListener('focus',read);return()=>{live=false;window.removeEventListener('focus',read);};},[headquartersId,api,revision,retry]);
 useEffect(()=>{let live=true,seq=0;function read(){const request=++seq;setHomepage(null);setHomepageError('');readHomepage(headquartersId).then(v=>{if(live&&seq===request)setHomepage(v);}).catch(()=>{if(live&&seq===request)setHomepageError('ホームページの確認状況を取得できませんでした。');});}read();window.addEventListener('focus',read);return()=>{live=false;window.removeEventListener('focus',read);};},[headquartersId,readHomepage,revision,retry]);
 const [expanded,setExpanded]=useState<boolean|null>(null);
 useEffect(()=>setExpanded(null),[headquartersId]);
 const href=(path:string)=>toAcademyContextHref(path,headquartersId,'manage');
 const steps=[
 {title:'本部設定',done:state==='complete',pending:state===null,error:state==='error',icon:Building2,path:'/academy/settings?onboarding=1',action:onOpen,detail:state==='error'?'設定状況を確認できませんでした':state==='complete'?'登録した内容はいつでも変更できます':missing.length?missing.slice(0,2).join('・')+(missing.length>2?' ほか'+(missing.length-2)+'項目':''):'本部情報やお支払いを登録します'},
 {title:'ホームページ',done:!!homepage&&homepage.currentRevision>0,pending:!homepage&&!homepageError,error:!!homepageError,icon:Globe,path:courseCreated?'/academy/front':'/academy/front?setup=1',detail:homepageError?'保存状況を確認できませんでした':homepage?.currentRevision?homepage.publiclyAvailable?'公開中です':'保存済みです。公開はあとからでもOK':'教室の紹介や画像を整えます'},
 {title:'講座・販売プラン',done:courseCreated===true,pending:courseCreated===null,error:false,icon:BookOpen,path:courseCreated?'/academy/courses':'/academy/create?entry=new&tab=course',detail:courseCreated?'作成した講座やプランを確認できます':'講座の内容や料金を決めます'},
 {title:'公開・申込受付',done:recruitment===true,pending:recruitment===null,error:false,icon:CalendarDays,path:'/academy/offerings',detail:recruitment?'受付中の募集があります':'販売ページを公開して受付を始めます'}
 ];
 const completed=steps.filter(step=>step.done).length,allKnown=steps.every(step=>!step.pending),allDone=completed===steps.length;
 const open=expanded??(allKnown&&!allDone),next=steps.findIndex(step=>!step.done),hasError=steps.some(step=>step.error);
 const intro=onIntro?<button className={styles.intro} onClick={onIntro}>Academyでできること</button>:<Link className={styles.intro} href={href('/academy/settings?onboarding=1&intro=1')}>Academyでできること</Link>;
 return <section className={styles.panel} aria-label="Academyを始める準備">
  <div className={styles.header}><div className={styles.heading}><div><h2>Academyを始めるステップ</h2><p>{allDone?'4つのステップが完了しました':allKnown?'順番に進めて募集を始めましょう':'保存状況を確認しています…'}</p></div></div><div className={styles.tools}><span className={styles.progress}>{allKnown?completed+' / 4 完了':'確認中'}</span><button type="button" className={styles.toggle} aria-expanded={open} aria-controls={'academy-start-'+headquartersId} onClick={()=>setExpanded(!open)}>{open?'たたむ':'手順を見る'}<ChevronDown size={16} aria-hidden="true" className={open?styles.rotated:undefined}/></button></div></div>
  <div id={'academy-start-'+headquartersId} hidden={!open}><ol className={styles.steps}>{steps.map((step,index)=>{const Icon=step.icon;const content=<><span className={styles.stepTop}><span className={step.done?styles.completeNumber:styles.number}>{step.done?<Check size={15} aria-hidden="true"/>:index+1}</span><Icon size={19} aria-hidden="true"/><span className={styles.badge}>{step.pending?'確認中':step.error?'要確認':step.done?'完了':'未完了'}</span></span><strong>{step.title}</strong><span className={styles.detail}>{step.pending?'保存状況を確認しています…':step.detail}</span><span className={styles.stepAction}>{step.done?'確認・変更':step.error?'設定を確認':index===next?'ここから進める':'設定を開く'}<span aria-hidden="true"> →</span></span></>;return <li key={step.title} className={styles.step} data-complete={step.done} data-current={index===next&&!step.pending}>{step.action?<button type="button" className={styles.stepLink} onClick={step.action}>{content}</button>:<Link className={styles.stepLink} href={href(step.path)}>{content}</Link>}</li>;})}</ol></div>
  <div className={styles.footer}>{intro}{hasError&&<button className={styles.retry} onClick={()=>setRetry(v=>v+1)}>状況を再確認する</button>}</div>
 </section>;
}
