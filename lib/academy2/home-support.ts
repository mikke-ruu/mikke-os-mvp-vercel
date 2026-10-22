import {listSalesPlanDrafts} from './sales-plan-drafts';
import {getCourseEditor} from './course-editor';
import {getAcademy2Management} from './management';
import {readLessons} from '@/lib/academy/lesson-content';
import {listPublicOfferings} from '@/lib/academy/public-offerings';
import type {HeadquartersHomeData} from './headquarters-home';

/** Required by a saved plan; a course's temporary materialChoice is not a DB contract. */
export async function readHomeMaterialTasks(hq:string){
 const plans=await listSalesPlanDrafts(hq),ids=new Set<string>();
 for(const plan of plans){
  if(!(plan.configuration.materials?.enabled||plan.configuration.study_style==='materials_only'))continue;
  if((await getAcademy2Management(hq,'plan',plan.id)).archived)continue;
  plan.configuration.course_ids.forEach(id=>ids.add(id));
 }
 const rows=await Promise.all([...ids].map(async id=>{
  if((await getAcademy2Management(hq,'course',id)).archived)return null;
  const doc=await getCourseEditor(hq,id);
  return readLessons(doc.materials.blocks,doc.materials.curriculum).some(lesson=>lesson.blocks.length>0)?null:{id,name:doc.course.name};
 }));
 return rows.filter((row):row is {id:string;name:string}=>row!==null);
}
export async function readHomePublicCount(hq:string,storedCount:number){
 const items=await listPublicOfferings({headquartersId:hq});
 return {count:items.length,consistent:items.length===storedCount,offerings:items};
}
export const HOME_ACTIONS=[
 {key:'pay',icon:'¥',label:'入金確認',actions:['confirm_payment','confirm_tuition'],path:'/academy/applications?action=payment'},
 {key:'date',icon:'◷',label:'日程調整待ち',actions:['confirm_schedule'],path:'/academy/applications?action=schedule'},
 {key:'ship',icon:'▰',label:'発送準備',actions:['set_shipping_destination','record_shipping','ship_kit'],path:'/academy/applications?action=shipping'},
];
/** Display priority only. Never changes workflow states or executes commands. */
export function homeNextTasks(data:HeadquartersHomeData){
 const apps=data.applications??[],paths=new Set<string>();
 const tasks=HOME_ACTIONS.flatMap(group=>group.key==='pay'&&!data.permissions.finance?[]:apps.filter(a=>group.actions.includes(a.nextAction??'')).sort((a,b)=>a.appliedAt.localeCompare(b.appliedAt)).map(a=>{
  const path='/academy/applications/'+a.applicationId;paths.add(path);
  return {id:a.applicationId,title:`${a.applicantName}さんの${group.label==='日程調整待ち'?'日程調整':group.label}`,detail:a.planTitle,path};
 }));
 return [...tasks,...data.upcoming.filter(item=>!paths.has(item.path))].slice(0,3);
}
export function welcomeEligible(data:HeadquartersHomeData,basicSaved:boolean|null,hasRegisteredInformation:boolean){
 return basicSaved===false&&!hasRegisteredInformation&&!data.setup.course&&!data.setup.plan&&!data.setup.published&&!data.heroImageUrl&&!data.logoUrl&&data.applications?.length===0&&data.events?.length===0;
}
