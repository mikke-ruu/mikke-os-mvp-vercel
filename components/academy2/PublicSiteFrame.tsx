'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {readPublicSiteIdentity,type PublicSiteIdentity} from '@/lib/academy2/public-site-frame';
import {readFrontDocument,frontMaxWidth} from '@/lib/academy/front-design';
import {publicDocumentLinks} from './PublicHeadquartersInformation';
import homeStyles from './public-homepage.module.css';
import styles from './public-course-page.module.css';
type Site=Pick<PublicSiteIdentity,'name'|'handle'|'tagline'|'contact_email'|'front_blocks'>;
export function PublicSiteFooter({front}:{front:Site}){
 const document=readFrontDocument(front.front_blocks??[]),visibility=document.design.visibility;
 return <footer className={homeStyles.footer}><div className={homeStyles.footerInner} style={{maxWidth:frontMaxWidth(document.design)}}><section className={homeStyles.about} id="about"><h2>{visibility?.name!==false?front.name:'本部のご案内'}</h2>{visibility?.tagline!==false&&front.tagline&&<p>{front.tagline}</p>}{front.contact_email&&<p id="contact"><a href={'mailto:'+front.contact_email}>お問い合わせ：{front.contact_email}</a></p>}</section><nav className={homeStyles.footerNav} aria-label="本部のご案内と規約">{publicDocumentLinks.map(([id,label])=><a key={id} href={'/academy/site/'+encodeURIComponent(front.handle)+'/information#'+id}>{label}</a>)}</nav></div><p className={homeStyles.credit}>POWERED BY Academy</p></footer>;
}
export function PublicSiteFrame({headquartersId,children,homeLabel='ホームへ戻る'}:{headquartersId:string;children:ReactNode;homeLabel?:string}){
 const [state,setState]=useState<{hq:string;front:PublicSiteIdentity|null;error:boolean}|null>(null),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setState(null);readPublicSiteIdentity(headquartersId).then(front=>{if(live)setState({hq:headquartersId,front,error:false});}).catch(()=>{if(live)setState({hq:headquartersId,front:null,error:true});});return()=>{live=false;};},[headquartersId,retry]);
 const front=state?.hq===headquartersId?state.front:null;
 return <div className={styles.surface}>{front&&<header className={styles.siteBar}>{readFrontDocument(front.front_blocks).design.visibility?.name!==false&&<span>{front.name}</span>}<a href={'/academy/site/'+encodeURIComponent(front.handle)}>← {homeLabel}</a></header>}{children}{front?<PublicSiteFooter front={front}/>:state?.error?<aside className={styles.siteError}><p>本部のご案内を読み込めませんでした。</p><button onClick={()=>setRetry(v=>v+1)} type="button">再読み込み</button></aside>:null}</div>;
}
