'use client';
import {useState} from 'react';
import {BookOpen,Wallet,Globe,CalendarDays,ClipboardList,Package,GraduationCap} from 'lucide-react';
import type {Academy2HeadquartersContext} from '@/lib/academy2/context';
import type {HeadquartersSetupApi} from '@/lib/academy2/headquarters-setup-api';
import {GuidedHeadquartersSetup} from './GuidedHeadquartersSetup';
import {SettingsDialog} from './SettingsDialog';
import styles from './headquarters-settings.module.css';
const features=[['講座をつくる','講座の内容や教材を登録できます',BookOpen],['販売プランをつくる','料金や支払方法を設定できます',Wallet],['ページをつくる','本部のホームページや講座の募集ページを作成できます',Globe],['開催を管理する','開催日時の設定や個別日程の相談ができます',CalendarDays],['申込を管理する','申込内容や入金状況をまとめて確認できます',ClipboardList],['教材を共有する','受講者に教材を届けられます',Package],['修了を管理する','受講状況や修了を記録できます',GraduationCap]] as const;
const future=[['月額の講座を開く','毎月のレッスンや教材・キットを届ける講座を運営できます。'],['認定のしくみをつくる','受講者の認定や認定講師としての活動を支えます。'],['講師への支払いをまとめる','講師に支払う金額や支払い状況を管理します。'],['売上をまとめて見る','講座ごとの売上を集計します。'],['お問い合わせを受け付ける','講座へのお問い合わせをまとめて確認できます。'],['ショップにつなぐ','Item Studioのショップで継続用の教材や商品をご案内します。'],['交流の場につなぐ','Communityで受講後も交流や学びを続けられます。'],['記事や動画につなぐ','Mediaの講座に関連する記事や動画をご案内します。']];
export function AcademyGettingStarted({headquarters,userId,onClose,api,previewOnly=false,startWithSetup=false,onCreate}:{headquarters:Academy2HeadquartersContext;userId:string;onClose:()=>void;api?:HeadquartersSetupApi;previewOnly?:boolean;startWithSetup?:boolean;onCreate?:()=>void}){
 const [screen,setScreen]=useState(startWithSetup?2:0);
 function remember(state:'seen'|'skipped'){try{localStorage.setItem('academy2:intro:v1:'+userId+':'+headquarters.id,state);}catch{}}
 if(screen===2)return <GuidedHeadquartersSetup headquarters={headquarters} onClose={onClose} api={api} previewOnly={previewOnly} onCreate={onCreate}/>;
 return <SettingsDialog title={screen===0?'Academyへようこそ！':'Academyでできること'} onClose={()=>{remember('skipped');onClose();}} wide>
 <div className={styles.dialogBody}>{screen===0?<><h2>講座づくりから運営まで、ひとつに。</h2><p>教室やオンライン講座など、あなたの講座を届ける場所をつくりましょう。</p><ol className={styles.welcomeSteps}>{['本部の情報を登録する','ホームページを整える','講座をつくる','料金や受講方法を決める','販売ページを公開する','開催日程を追加して募集する'].map((label,index)=><li key={label}><span>{index+1}</span>{label}</li>)}</ol><p className={styles.help}>教材のみの販売など、受講方法によって日程が不要な場合もあります。</p></>:<><div className={styles.introFeatures}>{features.map(([title,description,Icon])=><section className={styles.introFeature} key={title}><Icon size={25} aria-hidden="true"/><div><h3>{title}</h3><p>{description}</p></div></section>)}</div><p className={styles.help}>ご利用には、担当権限や講座・販売プランごとの条件があります。</p><details className={styles.preview}><summary>今後の予定を見る</summary><div className={styles.introFeatures}>{future.map(([title,text])=><section className={styles.introFeature} key={title}><BookOpen size={25} aria-hidden="true"/><div><h3>{title}</h3><p>{text}</p></div></section>)}</div><p className={styles.help}>今後の予定です。内容は変更になる場合があります。</p></details></>}</div>
 <footer className={styles.dialogFooter}><button className={styles.btn} onClick={()=>{remember('skipped');onClose();}}>スキップ</button>{screen===1&&<button className={styles.btn} onClick={()=>setScreen(0)}>戻る</button>}<button className={styles.btn+' '+styles.orange} onClick={()=>{if(screen===0)setScreen(1);else{remember('seen');setScreen(2);}}}>{screen===0?'次へ':'初期設定を始める'}</button></footer>
 </SettingsDialog>;
}
