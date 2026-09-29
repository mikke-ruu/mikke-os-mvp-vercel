import type {LpBlock} from '@/components/mikkeos/page-builder/lp-design';
import type {Academy2Course} from './courses';
import type {SalesPlanDraft} from './sales-plan-drafts';

/** Content only. Prices, availability and application conditions stay in their authoritative contracts. */
export function standardSalesPageBlocks(draft:SalesPlanDraft,courses:Academy2Course[]):LpBlock[]{
 const config=draft.configuration;
 const ids=config.course_ids.length?config.course_ids:draft.course_snapshot.map(course=>course.course_id);
 const selected=ids.flatMap(id=>courses.filter(course=>course.id===id&&course.show_introduction!==false));
 const first=selected[0];
 const text:LpBlock[]=[{id:crypto.randomUUID(),type:'heading',level:2,text:config.title,lp:{desktop:{size:31,lineHeight:1.3},mobile:{size:25}}}];
 if(first?.subtitle)text.push({id:crypto.randomUUID(),type:'paragraph',text:first.subtitle,lp:{desktop:{size:11,lineHeight:1.8}}});
 text.push({id:crypto.randomUUID(),type:'cta',buttonLabel:'開催日程・お申込みを見る',url:'#apply'});
 const hero:LpBlock={id:crypto.randomUUID(),type:'paragraph',lp:{desktop:{padding:44,columns:first?.main_image_url?2:1,gap:24,background:'#faf9f7'},mobile:{padding:22,columns:1},children:[{id:crypto.randomUUID(),type:'paragraph',lp:{children:text}},...(first?.main_image_url?[{id:crypto.randomUUID(),type:'image' as const,imageUrl:first.main_image_url,caption:first.name}]:[])]}};
 const blocks=[hero];
 if(config.show_course_introductions!==false){
  blocks.push({id:crypto.randomUUID(),type:'heading',level:2,text:'講座について',lp:{desktop:{size:21,padding:24},mobile:{padding:22}}});
  for(const course of selected)blocks.push({id:crypto.randomUUID(),type:'paragraph',title:course.name,lp:{reference:{kind:'academy-course',id:course.id,imageSide:'left'},desktop:{padding:24},mobile:{padding:22}}});
 }
 return blocks;
}
