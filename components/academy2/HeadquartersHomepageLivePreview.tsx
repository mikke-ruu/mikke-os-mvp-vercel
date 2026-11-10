'use client';
import {useEffect,useRef,useState} from 'react';
import type {PublishedSalesPageSummary} from '@/lib/academy2/plan-publication';
import type {PublicOfferingSummary} from '@/lib/academy/public-offerings';
import type {PublicHomepage} from '@/lib/academy/public-homepage';
import type {HeadquartersFront} from '@/lib/academy2/headquarters-front';
import {HeadquartersHomepagePresentation} from './HeadquartersHomepagePresentation';
import styles from './homepage-editor.module.css';
/** Never stores draft content or sends it to a server. Channel expires with the editor. */
export function HeadquartersHomepageLivePreview({token,headquartersId,embedded=false}:{token:string;headquartersId:string;embedded?:boolean}){
 const lastSnapshot=useRef('');
 const connection=useRef<BroadcastChannel|null>(null);
 const [savedKey,setSavedKey]=useState<string|null>(null);
 const [front,setFront]=useState<HeadquartersFront|null>(null),[courses,setCourses]=useState<PublicHomepage['courses']>([]),[instructors,setInstructors]=useState<PublicHomepage['instructors']>([]),[publicOfferings,setPublicOfferings]=useState<PublicOfferingSummary[]|undefined>(undefined),[publishedPages,setPublishedPages]=useState<PublishedSalesPageSummary[]|undefined>(undefined),[last,setLast]=useState(0),[now,setNow]=useState(Date.now()),[mobile,setMobile]=useState(false);
 useEffect(()=>{if(!/^[a-f0-9-]{36}$/i.test(token)||!('BroadcastChannel' in window))return;const channel=new BroadcastChannel('academy-homepage-'+token);connection.current=channel;channel.onmessage=event=>{const data=event.data;if(data?.kind==='snapshot'&&data.front?.id===headquartersId){setLast(Date.now());const key=JSON.stringify([data.front,data.savedKey,data.courses,data.instructors,data.publicOfferings,data.publishedPages]);if(key===lastSnapshot.current)return;lastSnapshot.current=key;setFront(data.front);setSavedKey(typeof data.savedKey==='string'?data.savedKey:null);setCourses(Array.isArray(data.courses)?data.courses:[]);setInstructors(Array.isArray(data.instructors)?data.instructors:[]);setPublicOfferings(Array.isArray(data.publicOfferings)?data.publicOfferings:undefined);setPublishedPages(Array.isArray(data.publishedPages)?data.publishedPages:undefined);setLast(Date.now());}};const request=()=>{channel.postMessage({kind:'request'});setNow(Date.now());};request();const timer=setInterval(request,2000);return()=>{clearInterval(timer);connection.current=null;channel.close();};},[token,headquartersId]);
 const disconnected=last>0&&now-last>15000;
 useEffect(()=>{if(front&&!disconnected&&savedKey&&(!mobile||embedded))connection.current?.postMessage({kind:'viewed',headquartersId,savedKey});},[front,disconnected,savedKey,headquartersId,mobile,embedded]);
 const frameUrl=typeof window==='undefined'?'':(()=>{const url=new URL(window.location.href);url.searchParams.set('previewFrame','1');return url.href;})();
 if(embedded)return <div className={styles.embeddedPreview}>{front&&!disconnected?<HeadquartersHomepagePresentation front={front} courses={courses} instructors={instructors} publicOfferings={publicOfferings} publishedPages={publishedPages}/>:<p role="status">編集画面に接続しています…</p>}</div>;
 return <div className={styles.livePreview}><nav className={styles.previewToolbar}><strong>お客様向けの表示確認</strong><span>編集中・公開内容は変わりません</span><button type="button" aria-pressed={!mobile} onClick={()=>setMobile(false)}>PC</button><button type="button" aria-pressed={mobile} onClick={()=>setMobile(true)}>スマホ</button><button type="button" onClick={()=>window.close()}>編集画面へ戻る</button></nav>{!front||disconnected?<p role="status">{disconnected?'編集画面との接続が切れました。元の編集タブから、もう一度確認画面を開いてください。':'編集画面との接続を待っています。元の編集タブを開いたままにしてください。'}</p>:<>{now-last>7000&&<p role="status">編集画面との接続が止まっています。最後に受け取った内容を表示しています。</p>}{mobile?<iframe className={styles.mobileFrame} src={frameUrl} title="スマホ幅のお客様向けホームページ"/>:<div className={styles.desktopPage}><HeadquartersHomepagePresentation front={front} courses={courses} instructors={instructors} publicOfferings={publicOfferings} publishedPages={publishedPages}/></div>}</>}</div>;
}
