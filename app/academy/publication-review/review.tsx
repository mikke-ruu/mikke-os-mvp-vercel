'use client';
import {useState,useEffect,useRef} from 'react';
import hero from './earrings-hero.png';
import {PublicationStatusCard} from '@/components/academy2/PublicationStatusCard';
import {PublicationChecklist} from '@/components/academy2/PublicationChecklist';
import type {SalesPlanPublicationState} from '@/lib/academy2/sales-plan-catalog';
import styles from '@/components/academy2/publication-flow.module.css';
const title='天然石と淡水パールで作る はじめての耳飾り';
export function PublicationReview(){
 const [view,setView]=useState('course'),[published,setPublished]=useState(false),[payment,setPayment]=useState(true),[terms,setTerms]=useState(true),[editing,setEditing]=useState(''),[saved,setSaved]=useState(false);
 const editPanel=useRef<HTMLElement|null>(null);
 useEffect(()=>{if(editing)editPanel.current?.scrollIntoView({block:'start'});},[editing]);
 const publication:SalesPlanPublicationState={state:published?'published':'not_published',has_unpublished_changes:false,offering_id:null,public_path:'#public',published_at:null,plan_revision:1,page_revision:1};
 const tasks=[...(!payment?[{key:'payment',label:'振込先が未登録です。',href:'#payment',actionLabel:'振込先を登録する'}]:[]),...(!terms?[{key:'terms',label:'申込規約を確認してください。',href:'#terms',actionLabel:'申込規約を設定する'}]:[])];
 const navigate=(event:React.MouseEvent)=>{const link=(event.target as Element).closest('a');if(!link)return;const value=link.getAttribute('href');if(value?.startsWith('#')){event.preventDefault();if(value==='#payment'||value==='#terms'){setEditing(value.slice(1));setSaved(false);}else{setView(value.slice(1));window.scrollTo(0,0);}}};
 return <main onClick={navigate} style={{maxWidth:1000,margin:'auto',padding:'20px 16px 90px',color:'#24352d'}}>
 <p className={styles.small}>ローカルの操作見本です。写真はAI作例。保存・公開・申込は画面内だけで、本番データ・メール・決済には接続しません。</p>
 <nav className={styles.actions} aria-label="確認する画面">{[['course','講座'],['plan','販売プラン'],['review','販売ページの確認']].map(([id,label])=><button key={id} type="button" className={styles.button} onClick={()=>{setView(id);setEditing('');}}>{label}</button>)}</nav>
 {view==='course'&&<><h1 style={{fontSize:26,marginTop:24}}>{title}</h1><img src={hero.src} alt="天然石と淡水パールの耳飾りのAI作例" style={{width:'100%',maxWidth:480,borderRadius:16,marginTop:20}}/><section className={styles.card}><h2>この講座の販売プラン</h2><p>{title}</p><div className={styles.actions}><a className={styles.primary} href="#review">販売ページを確認・公開する</a><a className={styles.button} href="#plan">料金・販売内容を編集</a></div></section></>}
 {view==='plan'&&<><h1 style={{fontSize:26,marginTop:24}}>販売プラン</h1><h2>{title}</h2><PublicationStatusCard publication={publication} reviewHref="#review"/><section className={styles.card}><h2>保存されている内容</h2><p>料金：5,500円（材料キット・送料込み）</p><p>受講方法：オンライン</p><p>日程：申込後に個別相談</p><p>担当：野田あゆみ</p><p className={styles.small}>この見本では価格や本番の販売条件は変更しません。</p></section></>}
 {(view==='review'||view==='public')&&<><div className={styles.actions}><a className={styles.button} href="#plan">← 販売プランへ戻る</a></div><h1 style={{fontSize:26,marginTop:24}}>{view==='review'?'販売ページの確認・公開':'お客様に見えるページの見本'}</h1><article className={styles.card}><img src={hero.src} alt="耳飾りのAI作例" style={{width:'100%',maxHeight:480,objectFit:'contain',borderRadius:12}}/><h2 style={{marginTop:24}}>{title}</h2><p>天然石と淡水パールを組み合わせて、日常に使える耳飾りを作ります。</p><p>オンライン・個別日程相談／材料キットは事前に発送</p><p>5,500円（材料キット・送料込み）</p><p className={styles.small}>保存済みの講座をもとにした操作見本です。規約や販売者情報は本番の保存内容を取得していません。</p>{view==='public'&&<div className={styles.actions}><a className={styles.primary} href="#application">申込みへ進む（見本）</a></div>}</article>
 {view==='review'&&<section className={styles.card}><h2>{published?'公開しました（画面内のみ）':'内容を確認したら公開しましょう'}</h2><p>募集する日程：申込後に個別相談</p><PublicationChecklist tasks={tasks}/><div className={styles.actions}><button type="button" className={styles.primary} disabled={tasks.length>0} onClick={()=>setPublished(true)}>{published?'この内容を公開ページに反映する':'この内容で公開する'}</button>{published&&<a className={styles.button} href="#public">公開ページ・申込入口を確認する</a>}</div></section>}</>}
 {view==='application'&&<section className={styles.card}><h1>お申込み（画面内の見本）</h1><p>{title}</p><p>この画面では申込みを送信しません。実際の申込フォームと受信確認は、隔離環境・本番の承認を分けて確認します。</p><a className={styles.button} href="#public">← 販売ページへ戻る</a></section>}
 {editing&&<section ref={editPanel} id={editing} className={styles.card}><h2>{editing==='payment'?'振込先の設定（見本）':'申込規約の設定（見本）'}</h2><p>ここでは入力項目への往復だけ確認します。本番の情報は保存しません。</p><button type="button" className={styles.primary} onClick={()=>{editing==='payment'?setPayment(true):setTerms(true);setSaved(true);}}>設定済みにする（画面内のみ）</button>{saved&&<div className={styles.actions}><a className={styles.button} href="#review" onClick={()=>setEditing('')}>販売ページの確認へ戻る</a></div>}</section>}
 <details className={styles.card}><summary>ほかの状態を確認する</summary><div className={styles.actions}><button className={styles.button} onClick={()=>{setPayment(false);setTerms(false);setPublished(false);setEditing('');setView('review');}}>設定が足りない場合</button><button className={styles.button} onClick={()=>{setPayment(true);setTerms(true);setPublished(false);setEditing('');setView('plan');}}>最初の状態に戻す</button></div></details>
 </main>;
}
