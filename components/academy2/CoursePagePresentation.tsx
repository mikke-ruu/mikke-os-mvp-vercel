import {resolvePlanCoverImage} from '@/lib/academy2/plan-cover-image';
import {PlanCoverImage} from './PlanCoverImage';
import type {ReactNode} from 'react';
import type {SalesPlan} from '@/lib/academy2/sales-plan.mjs';
import type {LpBlock} from '@/components/mikkeos/page-builder/lp-design';
import {applicationContext} from '@/lib/academy2/application-conditions.mjs';
import {readSalesPageDisplay,salesPageDisplayId} from '@/lib/academy2/sales-page-display';
import {salesPageHasVisibleTitle} from './SalesPagePresentation';
import {PublicCourseFacts,type CoursePublicEvent} from './PublicCourseFacts';
import {ApplicationItemsSummary} from './ApplicationItemsSummary';
import {PublicCourseConditions} from './PublicCourseConditions';
import styles from './public-course-page.module.css';
import titleStyles from './sales-page-presentation.module.css';
/** Display only. Publication and application authority stay with each caller. */
export function CoursePagePresentation({title,blocks,children,price,events,methods,configuration,courses,fees,deadline,legalHref,accepting,staged=false,application,preview=false,informationOnly=false,decorateFixed,coverImage}:{coverImage?:unknown;informationOnly?:boolean;decorateFixed?:(title:string,content:ReactNode)=>ReactNode;title:string;blocks:LpBlock[];children:ReactNode;price:number|null;events:CoursePublicEvent[];methods:string[];configuration?:Partial<Pick<SalesPlan,'study_style'|'kit'|'after'|'course_ids'|'materials'|'cover_image'>>;courses:{id:string;physical_items?:{enabled?:boolean;name?:string;contents?:string}|null}[];fees?:string;deadline?:string;legalHref:string;accepting:boolean;staged?:boolean;application?:ReactNode;preview?:boolean}){
 const fixed=(title:string,content:ReactNode)=>decorateFixed?decorateFixed(title,content):content;
 const display=readSalesPageDisplay(blocks),configured=blocks.some(b=>b.id===salesPageDisplayId);
 return <main className={styles.page} data-course-tone={display.tone} data-course-spacing={display.spacing} data-price-align={display.priceAlign}>
  {fixed('講座名・受付状況',<><p className={styles.eyebrow}>講座のご案内</p><span className={styles.status}>{preview?'販売ページのプレビュー':staged?'受講内容をご確認ください':accepting?'お申し込み受付中':'現在は受付していません'}</span>
  <h1 className={salesPageHasVisibleTitle(blocks,title)?titleStyles.screenTitle:undefined}>{title}</h1></>)}
  {resolvePlanCoverImage(coverImage??configuration?.cover_image,[]).source==='custom'&&fixed('販売プランの代表画像',<PlanCoverImage value={coverImage??configuration?.cover_image} title={title}/>)}
  <div className={styles.customContent}>{children}</div>
  {fixed('受講料・開催日程',<PublicCourseFacts informationOnly={informationOnly} price={price} staged={staged} events={events} methods={methods} kit={configuration?.kit} materialsOnly={configuration?.study_style==='materials_only'} priceHeading={configured?display.priceHeading:undefined} scheduleHeading={display.scheduleHeading}/>)}
  {(configuration?.kit?.enabled||configuration?.materials?.enabled||configuration?.after?.certificate?.delivery&&configuration.after.certificate.delivery!=='digital')&&fixed('教材・材料の案内',<ApplicationItemsSummary configuration={configuration} courses={courses} context={applicationContext(configuration??{},null,'headquarters')} eventSelected={configuration?.study_style==='materials_only'} applicationForm={false}/>)}
  {legalHref&&fixed('お支払い・規約',<PublicCourseConditions legalHref={legalHref} deadline={deadline} fees={fees}/>)}
  {fixed('お申し込み',<section id="apply" className={styles.cta}>{configured&&<h2>{display.applicationHeading}</h2>}{accepting||preview?<>{staged&&<p>今回受講する講座と料金は、お申し込み画面でご確認ください。</p>}{application}</>:<p>現在、お申し込みを受け付けていません。</p>}</section>)}
 </main>;
}
