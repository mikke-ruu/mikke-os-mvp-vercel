'use client';
import {Fragment,type ReactNode} from 'react';
import Link from 'next/link';
import type {LpBlock} from '@/components/mikkeos/page-builder/lp-design';
import {LpContent} from '@/components/mikkeos/page-builder/LpDesign';
import type {AcademyCourseCardInfo} from '@/components/academy/AcademyCourseCard';
import {courseImages,courseMarketing} from '@/lib/academy/course-marketing';
import {courseIntroductionHref} from '@/lib/academy2/course-introduction';
import {standardSalesPageV5Id,standardCourseHeadingV5Id,standardCourseCardPrefix} from '@/lib/academy2/standard-sales-page';
import {salesPageContentBlocks} from '@/lib/academy2/sales-page-display';
import {CoursePhotoGallery} from './CoursePhotoGallery';
import styles from './standard-sales-page-v5.module.css';

type Course=AcademyCourseCardInfo&{id:string};
type Decorate=(block:LpBlock,content:ReactNode)=>ReactNode;
type IconKind='book'|'calendar'|'clock'|'payment'|'kit'|'path'|'form'|'mail'|'study';
export function StandardV5Icon({kind}:{kind:IconKind}){
 const paths:Record<IconKind,ReactNode>={
  book:<path d="M4 5.5c3-1 5-1 8 1v13c-3-2-5-2-8-1zM20 5.5c-3-1-5-1-8 1v13c3-2 5-2 8-1z"/>,
  calendar:<><rect height="16" rx="2" width="18" x="3" y="5"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
  clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></>,
  payment:<><rect height="14" rx="2" width="20" x="2" y="5"/><path d="M2 10h20"/></>,
  kit:<path d="m3 7 9-4 9 4v10l-9 4-9-4zM3 7l9 5 9-5M12 12v9"/>,
  path:<><circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h6a4 4 0 0 1 0 8h-2a4 4 0 0 0 0 4h6"/></>,
  form:<><rect height="17" rx="2" width="14" x="5" y="4"/><path d="M9 4h6M8 10h8M8 14h8"/></>,
  mail:<><rect height="14" rx="2" width="18" x="3" y="5"/><path d="m3 7 9 7 9-7"/></>,
  study:<path d="m2 9 10-5 10 5-10 5zM6 11v6c3 3 9 3 12 0v-6M22 9v7"/>
 };
 return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[kind]}</svg>;
}
function Heading({icon,children}:{icon:IconKind;children:ReactNode}){return <h2 className={styles.heading}><StandardV5Icon kind={icon}/>{children}</h2>;}
function images(course:Course){return courseImages(courseMarketing(course.marketing??course.feature_settings?.marketing),course.main_image_url).slice(0,3);}
export function StandardV5Courses({courses,heading,returnHref,previewHq,decorate,courseBlocks,headingBlock,headingContent}:{courses:Course[];heading?:string;returnHref?:string;previewHq?:string;decorate?:Decorate;courseBlocks?:LpBlock[];headingBlock?:LpBlock;headingContent?:ReactNode}){
 const visible=courses.filter(c=>c.show_introduction!==false);
 if(!visible.length)return null;
 const mark=(course:Course,content:ReactNode)=>{const block=courseBlocks?.find(b=>b.lp?.reference?.id===course.id);return decorate&&block?decorate(block,content):content;};
 const title=headingContent??(heading&&<Heading icon="book">{heading}</Heading>);
 const sectionTitle=title&&decorate&&headingBlock?decorate(headingBlock,title):title;
 const body=(course:Course,index:number)=><><span className={styles.number}>COURSE {String(index+1).padStart(2,'0')}</span><h3>{course.name}</h3>{course.subtitle?.trim()&&<p>{course.subtitle}</p>}{course.duration_text?.trim()&&<p>学習時間の目安：{course.duration_text}</p>}<Link href={courseIntroductionHref(course.id,returnHref,previewHq)} target={previewHq?'_blank':undefined} rel={previewHq?'noopener noreferrer':undefined}>講座の詳細を見る →</Link></>;
 if(visible.length===1){const course=visible[0],photos=images(course);return <section className={styles.section}>{sectionTitle}{mark(course,<article className={`${styles['single-course']} ${photos.length?'':styles['no-photo']}`}>{photos.length>0&&<div className={styles['single-photo']}><CoursePhotoGallery dots images={photos} name={course.name}/></div>}<div className={styles['single-body']}>{body(course,0)}</div></article>)}</section>;}
 const withImages=visible.filter(c=>images(c).length);
 return <section className={styles.section}>{sectionTitle}{withImages.length>0&&<div className={`${styles.gallery} ${withImages.length===1?styles.one:''}`}>{withImages.map(course=><figure className={styles.photo} key={course.id}><CoursePhotoGallery dots images={images(course)} name={course.name}/><figcaption>{course.name}</figcaption></figure>)}</div>}<div className={styles.courses}>{visible.map((course,index)=>mark(course,<article className={styles.course} key={course.id}>{body(course,index)}</article>))}</div></section>;
}
/** The saved block array remains authoritative: only contiguous reference groups are laid out. */
export function StandardV5Content({blocks,courses,renderFallback,returnHref,previewHq,decorate,includeHidden=false,renderHeading}:{blocks:LpBlock[];courses:Course[];renderFallback:(blocks:LpBlock[])=>ReactNode;returnHref?:string;previewHq?:string;decorate?:Decorate;includeHidden?:boolean;renderHeading?:(block:LpBlock)=>ReactNode}){
 const visible=salesPageContentBlocks(blocks).filter(b=>includeHidden||b.lp?.hidden!==true);
 const mark=(block:LpBlock,content:ReactNode)=>decorate?decorate(block,content):content;
 const output:ReactNode[]=[];
 for(let i=0;i<visible.length;i++){
  const block=visible[i];
  if(block.id===standardSalesPageV5Id){output.push(<Fragment key={block.id}>{mark(block,<section className={`${styles.section} ${styles.hero}`}><div className={styles.eyebrow}>COURSE PLAN</div><LpContent honorVisibility={!includeHidden} minimumFontSize={14} standaloneButtons blocks={[block]} render={renderFallback} decorate={decorate?(b,content)=>b.id===block.id?content:mark(b,content):undefined}/></section>)}</Fragment>);continue;}
  const heading=block.id===standardCourseHeadingV5Id?block.text:undefined;
  const isReference=(b:LpBlock|undefined)=>!!b?.lp?.reference&&b.id.startsWith(standardCourseCardPrefix);
  if(heading!==undefined||isReference(block)){
   const refs:LpBlock[]=[];if(isReference(block))refs.push(block);
   while(isReference(visible[i+1]))refs.push(visible[++i]);
   if(heading!==undefined&&!refs.length){
    const hasLaterCourse=visible.slice(i+1).some(ref=>isReference(ref)&&courses.some(course=>course.id===ref.lp?.reference?.id&&course.show_introduction!==false));
    if(includeHidden||hasLaterCourse)output.push(<Fragment key={block.id}>{mark(block,<section className={styles.section}>{renderHeading?.(block)??<Heading icon="book">{heading}</Heading>}</section>)}</Fragment>);continue;
   }
   const selected=refs.flatMap(ref=>courses.filter(c=>c.id===ref.lp?.reference?.id));
   output.push(<StandardV5Courses key={block.id} courses={selected} heading={heading} returnHref={returnHref} previewHq={previewHq} decorate={decorate} courseBlocks={refs} headingBlock={heading!==undefined?block:undefined} headingContent={heading!==undefined?renderHeading?.(block):undefined}/>);continue;
  }
  output.push(<div key={block.id}>{mark(block,<section className={styles.section}><LpContent honorVisibility={!includeHidden} minimumFontSize={14} standaloneButtons blocks={[block]} render={renderFallback} decorate={decorate?(b,content)=>b.id===block.id?content:mark(b,content):undefined}/></section>)}</div>);
 }
 return <>{output}</>;
}
export type StandardV5Event={id:string;title:string;startsAt:string|null;endsAt?:string|null;scheduleMode:string;format:string;kitMethod?:string|null;deliveryMethod?:string|null;registrationStatus?:string};
export type StandardV5InformationProps={events:StandardV5Event[];price:number|null;paymentMethods:string[];materialsOnly?:boolean;kit?:{enabled?:boolean;name?:string};termsBody?:string;applicationHref?:string;onApply?:()=>void;unavailable?:boolean;previewOnly?:boolean};
const dateFormat=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'long',day:'numeric',weekday:'short'});
const timeFormat=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit'});
export function StandardV5Information({events,price,paymentMethods,materialsOnly,kit,termsBody,applicationHref,onApply,unavailable,previewOnly=false}:StandardV5InformationProps){
 const arranged=events.some(e=>e.scheduleMode==='arranged_after_application');
 const fixed=events.filter(e=>e.scheduleMode!=='arranged_after_application'&&e.startsAt&&Number.isFinite(Date.parse(e.startsAt)));
 const formats=[...new Set(events.map(e=>e.format==='online'?'オンライン':'対面'))];
 const kitEnabled=kit?.enabled===true;
 const methods=[...new Set(events.map(e=>e.deliveryMethod??e.kitMethod).filter(Boolean))];
 const shipping=methods.length>0&&methods.every(m=>m==='shipping'||m==='learner_shipping');
 const handover=methods.length>0&&methods.every(m=>m==='venue_handover')&&events.every(e=>e.deliveryMethod==='venue_handover');
 // Public v2 kitMethod collapses handover and designated shipping; never guess the destination.
 const kitNote=shipping?'教材・キットは発送します。詳しい発送時期はご案内をご確認ください。':handover?'教材・キットは当日、会場でお渡しします。':'教材・キットの受け渡し方法と時期は、開催ごとのご案内をご確認ください。';
 const supportedMethods=paymentMethods.filter(method=>['bank','external','onsite'].includes(method));
 const paymentLabels:Record<string,string>={bank:'銀行振込',external:'外部決済',onsite:'当日、会場でお支払い'};
 const flows=supportedMethods.map(method=>{
  const steps:{icon:IconKind;title:string;note:string}[]=[{icon:'form',title:'お申し込み',note:'専用フォームから'}];
  if(method==='bank')steps.push({icon:'mail',title:'お支払いのご案内',note:'メールでお知らせ'},{icon:'payment',title:'お支払い',note:'ご案内に沿ってお手続き'});
  else steps.push({icon:'payment',title:'お支払い',note:method==='external'?'申込後、決済ページから':'当日、会場で'});
  steps.push({icon:'study',title:'ご受講',note:materialsOnly?'教材で学びます':arranged?'ご相談のうえ確定した日程で':previewOnly?'上記の開催日程で':'お選びいただいた日程で'});
  return <div key={method}>{supportedMethods.length>1&&<h3 className={styles.paymentLabel}>{paymentLabels[method]}</h3>}<div className={styles.flow} style={{gridTemplateColumns:steps.length===3?'repeat(3,minmax(0,1fr))':undefined}}>{steps.map((step,index)=><div className={styles.step} key={index}><div className={styles.circle}><StandardV5Icon kind={step.icon}/></div><strong>{step.title}</strong><small>{step.note}</small></div>)}</div></div>;
 });
 return <><section className={styles.section}><Heading icon="calendar">受講のご案内</Heading><div className={`${styles.guides} ${kitEnabled?styles['has-kit']:''}`}>
  <div className={styles.guide}><div className={styles.circle}><StandardV5Icon kind="calendar"/></div><div className={styles.label}>開催形式</div><div className={styles.value}>{materialsOnly?'教材で学ぶ':formats.join('・')||'開催情報をご確認ください'}</div></div>
  <div className={styles.guide}><div className={styles.circle}><StandardV5Icon kind="clock"/></div><div className={styles.label}>{materialsOnly?'受講方法':'開催日程'}</div><div className={styles.value}>{materialsOnly?'ご自身のペースで':arranged&&fixed.length?'日程指定・日程相談':arranged?'お申し込み後に相談':fixed.length?previewOnly?'保存済みの開催日時':'日程は申込時に選択':'受付中の開催はありません'}</div></div>
  <div className={`${styles.guide} ${styles.price}`}><div className={styles.circle}><StandardV5Icon kind="payment"/></div><div className={styles.label}>受講料</div><div className={styles.value}>{price===null?'料金をご確認ください':`¥${price.toLocaleString('ja-JP')}`}</div></div>
  {kitEnabled&&<div className={`${styles.guide} ${styles['kit-guide']}`}><div className={styles.circle}><StandardV5Icon kind="kit"/></div><div className={styles.label}>教材・キット</div><div className={styles.value}>{kit?.name?.trim()||'教材・キットあり'}</div></div>}
 </div>{!materialsOnly&&<div className={styles.dates}><h3><StandardV5Icon kind="calendar"/>{fixed.length?'開催予定':'日程について'}</h3>{previewOnly&&<p className={styles['date-hint']}>下記は保存済みの開催内容です。</p>}{fixed.length>0&&<>{!previewOnly&&<p className={styles['date-hint']}>下記の日程をご確認のうえ、お申し込みフォームでお選びください。</p>}<div className={styles['date-grid']}>{fixed.map(e=><div className={styles['date-tile']} key={e.id}><strong>{dateFormat.format(new Date(e.startsAt!))}</strong><span>{timeFormat.format(new Date(e.startsAt!))}{e.endsAt&&Number.isFinite(Date.parse(e.endsAt))?`〜${timeFormat.format(new Date(e.endsAt))}`:'〜'}</span><small>{e.format==='online'?'オンライン':'対面'} · {e.registrationStatus===undefined||e.registrationStatus==='open'?'受付中':e.registrationStatus==='draft'?'下書き':'受付停止中'}</small></div>)}</div></>}{arranged&&<div className={styles['consult-date']}>お申し込み後、ご希望を伺いながら開催日程を相談します。</div>}{!fixed.length&&!arranged&&<p className={styles['consult-date']}>現在、受付中の開催はありません。</p>}</div>}
 {termsBody?.trim()&&<details className={styles.terms}><summary>お申し込みに関する注意事項</summary><p>{termsBody}</p></details>}
 </section><section className={styles.section}><Heading icon="path">お申し込みから受講まで</Heading>{flows}{!materialsOnly&&<p className={styles.note}>{arranged?'日程はお申し込み後にご相談のうえ決定します。':previewOnly?'保存済みの開催日時をご確認ください。':'日程はお申し込みフォームでお選びください。'}</p>}{kitEnabled&&<div className={styles['kit-flow-note']}><StandardV5Icon kind="kit"/><strong>教材・キットについて</strong><div>{kitNote}</div></div>}</section><section className={`${styles.section} ${styles.cta}`}>{previewOnly?<><p>{unavailable?'現在、この開催のお申し込みは受け付けていません。':'保存済みの開催内容を確認しています。'}</p><button type="button" onClick={onApply}>申込フォームを確認</button></>:unavailable||!supportedMethods.length?<p>現在、お申し込みを受け付けていません。</p>:applicationHref?<Link href={applicationHref}>お申し込みへ →</Link>:<button type="button" onClick={onApply}>お申し込みへ →</button>}<p>{applicationHref?'お申し込みは別ページのフォームで受け付けます。':'申込フォームのプレビューを確認できます。'}</p></section></>;
}
