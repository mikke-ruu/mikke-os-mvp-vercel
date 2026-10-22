import type {LpBlock} from '@/components/mikkeos/page-builder/lp-design';
import type {Academy2Course} from './courses';
import type {SalesPlanDraft} from './sales-plan-drafts';

export const standardSalesPageV2Id='academy-standard-lp-v2';
export const standardSalesPageV5Id='academy-standard-lp-v5';
export const standardCourseHeadingV5Id='academy-standard-courses-v5';
export function isStandardSalesPageV5(blocks:LpBlock[]):boolean{return blocks.some(block=>block.id===standardSalesPageV5Id);}
/** Removing the title hides it without losing the saved page's presentation format. */
export function preserveStandardSalesPageFormat(previous:LpBlock[],next:LpBlock[]):LpBlock[]{
 if(!isStandardSalesPageV5(previous)||isStandardSalesPageV5(next))return next;
 return [{id:standardSalesPageV5Id,type:'paragraph',lp:{hidden:true}},...next];
}
export const standardCourseCardPrefix='academy-standard-course-';
export function isStandardSalesPageV2(blocks:LpBlock[]):boolean{return blocks.some(block=>block.id===standardSalesPageV2Id)||isStandardSalesPageV5(blocks);}
/** New pages only. Authoritative sales conditions remain outside the editable blocks. */
export function standardSalesPageBlocks(draft:SalesPlanDraft,courses:Academy2Course[]):LpBlock[]{
 const config=draft.configuration;
 const ids=config.course_ids.length?config.course_ids:draft.course_snapshot.map(course=>course.course_id);
 const selected=ids.flatMap(id=>courses.filter(course=>course.id===id&&course.show_introduction!==false));
 const first=selected[0];
 const title=config.title.trim()||first?.name||draft.course_snapshot[0]?.title||'';
 const text:LpBlock[]=[];
 if(title)text.push({id:crypto.randomUUID(),type:'heading',level:2,text:title,lp:{desktop:{size:32,lineHeight:1.4,color:'#25342f'},mobile:{size:24,lineHeight:1.4,padding:0}}});
 if(config.description?.trim())text.push({id:crypto.randomUUID(),type:'paragraph',text:config.description,lp:{desktop:{size:15,lineHeight:1.7,color:'#596860'},mobile:{size:15,lineHeight:1.7,padding:0}}});
 text.forEach(block=>{if(block.lp){block.lp.desktop={...block.lp.desktop,padding:0};}});
 const hero:LpBlock={id:standardSalesPageV5Id,type:'paragraph',lp:{desktop:{padding:0,gap:0,background:'#fff'},mobile:{padding:0,gap:0},children:text}};
 const blocks=[hero];
 if(config.show_course_introductions!==false&&selected.length){
  blocks.push({id:standardCourseHeadingV5Id,type:'heading',level:2,text:'このプランに含まれる講座',lp:{desktop:{size:20,lineHeight:1.5,padding:0,color:'#25342f'},mobile:{size:20,padding:0}}});
  for(const course of selected)blocks.push({id:standardCourseCardPrefix+course.id,type:'paragraph',title:course.name,lp:{reference:{kind:'academy-course',id:course.id,imageSide:'left'},desktop:{padding:0},mobile:{padding:0}}});
 }
 return blocks;
}
