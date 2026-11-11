'use client';
import type {ReactNode} from 'react';
import {Search,ClipboardPen,CalendarCheck,GraduationCap} from 'lucide-react';
import {PublicHomepageCatalog} from './PublicHomepageCatalog';
import {PublicSiteFooter} from './PublicSiteFrame';
import styles from './public-homepage.module.css';
import {AcademyFrontHero} from '@/components/academy/AcademyFrontHero';
import {PageBlocks} from '@/components/academy/PageBlocks';
import {readFrontDocument,frontMaxWidth} from '@/lib/academy/front-design';
import type {HeadquartersFront} from '@/lib/academy2/headquarters-front';
import type {PublishedSalesPageSummary} from '@/lib/academy2/plan-publication';
import type {PublicOfferingSummary} from '@/lib/academy/public-offerings';
import type {PublicHomepage} from '@/lib/academy/public-homepage';

type Front=Pick<HeadquartersFront,'id'|'name'|'tagline'|'front_message'|'hero_image_url'|'contact_email'|'front_blocks'|'logo_url'>&{handle?:string};
const steps=[
 {icon:Search,title:'講座を選ぶ',description:'内容や受講方法を確認します。'},
 {icon:ClipboardPen,title:'申し込む',description:'日程を選んで申し込みます。'},
 {icon:CalendarCheck,title:'受講する',description:'案内に沿って受講します。'},
 {icon:GraduationCap,title:'受講後のご案内',description:'教材などの案内を確認します。'},
];
/** Public and authenticated previews share a public-field-only presentation. No writes. */
export function HeadquartersHomepagePresentation({front,courses=[],instructors=[],returnToAcademy=false,publicOfferings,publishedPages,renderBody,decorateFixed}:{decorateFixed?:(title:string,content:ReactNode)=>ReactNode;renderBody?:(blocks:ReturnType<typeof readFrontDocument>['blocks'])=>ReactNode;returnToAcademy?:boolean;publicOfferings?:PublicOfferingSummary[];publishedPages?:PublishedSalesPageSummary[];front:Front;courses?:PublicHomepage['courses'];instructors?:PublicHomepage['instructors']}){
 const fixed=(title:string,content:ReactNode)=>decorateFixed?decorateFixed(title,content):content;
 const document=readFrontDocument(front.front_blocks??[]);
 const visibility=document.design.visibility;
 return <main className={styles.page} aria-label={front.name+'のホームページ'}>
  {fixed('ヘッダー',<header className={styles.header}><div className={styles.headerInner} style={{maxWidth:frontMaxWidth(document.design)}}><div className={styles.identity}>{visibility?.logo!==false&&front.logo_url&&<img src={front.logo_url} alt={visibility?.name!==false?'':front.name}/>} {visibility?.name!==false&&<p>{front.name}</p>}</div><nav className={styles.nav} aria-label="ホームページのメニュー"><a href="#courses">講座のご案内</a><a href="#about">本部について</a><a href="#contact">お問い合わせ</a></nav></div></header>)}
  {fixed('教室の紹介・画像',<div className={styles.hero}><AcademyFrontHero showTitle={visibility?.tagline!==false&&!!front.tagline} hideEmptyImage design={document.design} title={front.tagline||''} message={front.front_message||'講座やワークショップをご紹介します。'} imageUrl={front.hero_image_url||''} applicationHref={null} coursesHref={null}/></div>)}
  {(!!document.blocks.length||!!renderBody)&&<section className="px-5 py-8"><div className="mx-auto" style={{maxWidth:frontMaxWidth(document.design,768)}}>{renderBody?renderBody(document.blocks):<PageBlocks blocks={document.blocks}/>}</div></section>}
  {fixed('講座・ワークショップ',<div className="mx-auto px-5" style={{maxWidth:frontMaxWidth(document.design)}}><PublicHomepageCatalog hq={front.id} pages={publishedPages} offerings={publicOfferings}/></div>)}
  {!!courses.length&&front.handle&&<section className="mx-auto px-5 py-8" style={{maxWidth:frontMaxWidth(document.design)}}><h2 className="text-center text-xl font-semibold">講座・ワークショップ</h2><ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{courses.map(course=><li key={course.id} className="overflow-hidden rounded-2xl border border-[#e2e7e4]">{course.main_image_url?<img src={course.main_image_url} alt="" className="h-44 w-full object-cover"/>:null}<div className="p-5"><h3 className="text-base font-semibold">{course.name}</h3>{course.subtitle&&<p className="mt-2 text-sm leading-6">{course.subtitle}</p>}<p className="mt-3 text-sm">基本価格 {course.price.toLocaleString()}円{course.duration_text?' ／ '+course.duration_text:''}</p><a className="mt-3 inline-flex min-h-11 items-center text-sm underline" href={'/academy/site/'+encodeURIComponent(front.handle!)+'/course/'+encodeURIComponent(course.id)+(returnToAcademy?'?from=academy':'')}>講座の内容を見る</a></div></li>)}</ul></section>}
  {!!instructors.length&&<section className="mx-auto px-5 py-8" style={{maxWidth:frontMaxWidth(document.design)}}><h2 className="text-center text-xl font-semibold">講師紹介</h2><ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">{instructors.map(instructor=><li key={instructor.id}><a className="block min-h-11 rounded-2xl border border-[#e2e7e4] p-4 text-center" href={'/academy/i/'+encodeURIComponent(instructor.id)}>{instructor.photo_url?<img className="mx-auto h-14 w-14 rounded-full object-cover" src={instructor.photo_url} alt=""/>:<span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e7f4ee]">{(instructor.business_name||'講')[0]}</span>}<h3 className="mt-3 text-sm font-semibold">{instructor.business_name||'認定講師'}</h3><p className="mt-1 text-xs">{instructor.area||''}{instructor.online_available?'・オンライン可':''}</p></a></li>)}</ul></section>}
  {fixed('お申し込みから受講まで',<div className="mx-auto px-5" style={{maxWidth:frontMaxWidth(document.design)}}><section className={styles.steps}><h2>お申し込みから受講まで</h2><ol>{steps.map((step,index)=><li key={step.title}><span className={styles.stepIcon}><step.icon size={21}/></span><small>STEP {index+1}</small><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol></section></div>)}
  {front.handle&&fixed('フッター',<PublicSiteFooter front={{...front,handle:front.handle}}/>)}
 </main>;
}
