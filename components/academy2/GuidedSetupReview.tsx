'use client';

import {useState} from 'react';
import {AcademyGettingStarted} from './AcademyGettingStarted';
import {SetupHomeStatus} from './SetupHomeStatus';
import type {HeadquartersSetupApi} from '@/lib/academy2/headquarters-setup-api';
import type {HeadquartersSettings} from '@/lib/academy2/headquarters-settings';
import {emptySellerDocument,type SellerProfile} from '@/lib/academy2/seller-disclosure';
import styles from './headquarters-settings.module.css';

export const headquarters={id:'11111111-1111-4111-8111-111111111111',name:'MUSUBI（画面確認用）',handle:'local-setup-review',role:'administrator' as const};
export function createReviewStore(){
 let serial=0,basicSaved=false,failNext=false,failRead=false;
 let bank={useBank:null as boolean|null,revision:0};
 const stamp=()=>new Date(1800000000000+(++serial)*1000).toISOString();
 let settings:HeadquartersSettings={basic:{name:headquarters.name,tagline:'',contact_email:'',default_payment_note:'',updated_at:stamp()},documents:[],members:[],invitations:[],connect:null,billing:null,operating_fee_state:'no_operating_fee'};
 let seller:SellerProfile={can_edit:true,actor_id:'22222222-2222-4222-8222-222222222222',revision:0,document:null,missing:[]};
 function check(){if(failNext){failNext=false;throw new Error('確認用に保存を失敗させました。入力内容は残っています。');}}
 const api:HeadquartersSetupApi={
 getBankPreference:async()=>structuredClone(bank),
 saveBankPreference:async(_hq,expected,useBank)=>{check();if(bank.revision!==expected)throw Object.assign(new Error("別の変更が保存されています。"),{code:"PT409"});bank={useBank,revision:expected+1};return structuredClone(bank);},
  getSettings:async()=>{if(failRead){failRead=false;throw new Error("確認用の取得失敗です。");}return structuredClone(settings);},
  getOnboarding:async()=>({basicSaved,hasEvent:false}),
  saveBasic:async(_hq,basic)=>{check();if(basic.updated_at!==settings.basic.updated_at)throw Object.assign(new Error('保存済みの内容が更新されています。'),{code:'PT409'});settings={...settings,basic:{...basic,updated_at:stamp()}};basicSaved=true;return structuredClone(settings);},
  saveDocument:async(_hq,kind,expected,version,body)=>{check();const previous=settings.documents.find(doc=>doc.kind===kind);if((previous?.revision??0)!==expected)throw Object.assign(new Error('保存済みの本文が更新されています。'),{code:'PT409'});settings={...settings,documents:[...settings.documents.filter(doc=>doc.kind!==kind),{kind,version,body,revision:expected+1,saved_at:stamp()}]};return structuredClone(settings);},
  getSeller:async()=>structuredClone(seller),
  saveSeller:async(_hq,expected,_request,document)=>{check();if(seller.revision!==expected)throw Object.assign(new Error('販売者情報が更新されています。'),{code:'PT409'});seller={...seller,revision:expected+1,document:structuredClone(document),missing:Object.keys(emptySellerDocument).filter(key=>key!=='inquiry_url'&&(key!=='representative'||document.business_type==='corporation')&&!document[key as keyof typeof document])};return structuredClone(seller);},
 };
 return {api,failOne:()=>{failNext=true;},failRead:()=>{failRead=true;},seedComplete:()=>{basicSaved=true;bank={useBank:false,revision:bank.revision+1};seller={...seller,revision:(seller.revision??0)+1,document:{...emptySellerDocument,business_type:'individual',legal_name:'ローカル確認用',postal_address:'確認用',contact_phone:'03-0000-0000',contact_email:'review@example.invalid',additional_fees:'確認用',payment_deadline:'確認用',provision_timing:'確認用',publication_consent:true},missing:[]};settings={...settings,basic:{...settings.basic,contact_email:'review@example.invalid',tagline:'天然石と淡水パールのアクセサリー教室です。'},documents:(['application','commerce','cancellation','privacy'] as const).map(kind=>({kind,body:'画面確認用の保存済み本文。実際の規約ではありません。',revision:1,version:'review-v1',saved_at:stamp()}))};}};
}

/** Development-only screen review. No Auth simulation or database transport. */
export function GuidedSetupReview(){
 const [store]=useState(createReviewStore),[open,setOpen]=useState(true),[revision,setRevision]=useState(0),[creation,setCreation]=useState(false),[showIntro,setShowIntro]=useState(true);
 return <main className={styles.wrap}><div className={styles.titlebar}><h1>初期設定の画面確認</h1></div><p className={styles.note}>ローカルの画面確認用です。本番・実DB・メール・公開処理には接続しません。入力内容は再読み込みで消えます。</p><SetupHomeStatus headquartersId={headquarters.id} api={store.api} revision={revision} onOpen={()=>{setShowIntro(false);setOpen(true);}} onIntro={()=>{setShowIntro(true);setOpen(true);}}/>{creation&&<p className={styles.note}>講座作成への移動先：/academy/h/{headquarters.id}/manage/create?entry=new&amp;tab=course（このメモリ確認画面では実DBの講座を作りません）</p>}<div className={styles.actions}><button className={`${styles.btn} ${styles.orange}`} onClick={()=>{setShowIntro(true);setOpen(true);}}>初期設定を始める</button><button className={styles.btn} onClick={()=>{store.seedComplete();setRevision(v=>v+1);setOpen(false);}}>保存済みの例を読み込む（画面確認用）</button><button className={styles.btn} onClick={()=>{store.failRead();setRevision(v=>v+1);}}>取得失敗の動きを確認する</button><button className={styles.btn} onClick={()=>{store.failOne();setOpen(true);}}>保存失敗の動きを確認する</button></div>{open&&<AcademyGettingStarted startWithSetup={!showIntro} userId="local-review-user" headquarters={headquarters} onClose={()=>{setOpen(false);setRevision(v=>v+1);}} api={store.api} previewOnly onCreate={()=>setCreation(true)}/>}</main>;
}
