'use client';
import type {Academy2Course} from '@/lib/academy2/courses';
import type {LpBlock} from '@/components/mikkeos/page-builder/lp-design';
import {LpContent} from '@/components/mikkeos/page-builder/LpDesign';
import {AcademyLpRenderer} from '@/components/academy/AcademyLpRenderer';
import {AcademyCourseCard} from '@/components/academy/AcademyCourseCard';
import {standardCourseCardPrefix,isStandardSalesPageV5} from '@/lib/academy2/standard-sales-page';
import {salesPageContentBlocks} from '@/lib/academy2/sales-page-display';
import {PublicCourseDetailIntro} from './PublicCourseDetailIntro';
import {SalesCourseCard} from './SalesCourseCard';
import {StandardV5Content} from './StandardSalesPageV5';
export function renderSalesPageBlocks(blocks: LpBlock[], courses: Academy2Course[], returnHref?:string, previewHq?:string,offeringTitle="") {
  return blocks.map(block => {
    if (block.lp?.reference?.kind !== "academy-course") return <AcademyLpRenderer key={block.id} blocks={[block]} />;
    const course = courses.find(item => item.id === block.lp?.reference?.id);
    if(course&&block.id==='course-'+course.id&&!block.text&&!block.lp.children?.length)return <PublicCourseDetailIntro key={block.id} course={{...course,price:0}} offeringTitle={offeringTitle} imageSide={block.lp.reference.imageSide}/>;
    if(course&&block.id.startsWith(standardCourseCardPrefix))return <SalesCourseCard key={block.id} course={{...course,price:0}} returnHref={returnHref} previewHq={previewHq} imageSide={block.lp.reference.imageSide}/>;
    return course ? <AcademyCourseCard key={block.id} course={{ ...course, price: 0 }} hidePrice imageSide={block.lp.reference.imageSide} /> : <p key={block.id}>対象の講座を確認してください。</p>;
  });
}
/** The same responsive section renderer used on the existing public offering page. */
export function SalesPlanPageContent({ blocks, courses, returnHref, previewHq, offeringTitle }: { blocks: LpBlock[]; courses: Academy2Course[]; returnHref?:string;previewHq?:string;offeringTitle?:string }) {
  if(isStandardSalesPageV5(blocks))return <StandardV5Content blocks={blocks} courses={courses.map(course=>({...course,price:0}))} returnHref={returnHref} previewHq={previewHq} renderFallback={items=>renderSalesPageBlocks(items,courses,returnHref,previewHq)}/>;
  return <LpContent honorVisibility minimumFontSize={14} standaloneButtons blocks={salesPageContentBlocks(blocks)} render={items => renderSalesPageBlocks(items, courses,returnHref,previewHq,offeringTitle)} />;
}
