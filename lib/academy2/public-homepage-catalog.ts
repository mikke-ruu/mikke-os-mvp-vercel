import {resolvePlanCoverImage} from './plan-cover-image';
import {academyPublicClient} from '@/lib/academy/public-client';
import {listPublicOfferings,type PublicOfferingSummary} from '@/lib/academy/public-offerings';
import {getPublishedSalesPage,listPublishedSalesPages,type PublishedSalesPageSummary} from './plan-publication';

export type PublicCatalogEntry={id:string;title:string;price:number;href:string;image:string|null;description:string;note:string;availability:'open'|'before'|'check'};
type PublicCourse={main_image_url?:string|null;subtitle?:string|null;description?:string|null;duration_text?:string|null};
function courseCopy(courses:PublicCourse[],cover?:unknown){return {image:resolvePlanCoverImage(cover,courses).url,description:courses.find(c=>c.subtitle?.trim())?.subtitle||courses.find(c=>c.description?.trim())?.description||'',note:[...new Set(courses.map(c=>c.duration_text?.trim()).filter(Boolean))].join('・')};}
/** Read only existing public projections. Failure never becomes an open intake. */
export async function readPublicCatalogOffering(item:PublicOfferingSummary):Promise<PublicCatalogEntry>{
 const base:PublicCatalogEntry={id:'offering-'+item.id,title:item.title,price:item.price,href:'/academy/o/'+item.id,image:null,description:'',note:'',availability:'check'};
 const {data,error}=await academyPublicClient.rpc('academy2_public_intake_with_form',{p_id:item.id,p_instructor:false}).abortSignal(AbortSignal.timeout(20000));
 if(error)throw new Error('受付状況を確認できませんでした。');
 if(!data||data.mode!=='headquarters'||data.offering?.id!==item.id||data.offering?.headquarters_id!==item.headquarters_id)return base;
 const events=Array.isArray(data.events)?data.events:[];
 const ready=!!data.applicationForm&&(!data.applicationForm.readinessReasons||Array.isArray(data.applicationForm.readinessReasons)&&data.applicationForm.readinessReasons.length===0);
 const openEvent=events.some((e:{registrationStatus?:string;formReady?:boolean;startsAt?:string;scheduleMode?:string})=>e.registrationStatus==='open'&&e.formReady!==false&&(e.scheduleMode==='arranged_after_application'||!!e.startsAt&&Date.parse(e.startsAt)>Date.now()));
 const canOffer=ready&&item.kind!=='月額レッスン'&&Array.isArray(data.offering.payment_methods)&&data.offering.payment_methods.some((m:string)=>['bank','external','card','onsite'].includes(m))&&(!data.eventRequired||openEvent);
 return {...base,...courseCopy(data.offering.courses??[],data.offering.cover_image),availability:canOffer?'open':'before'};
}
export async function readPublicCatalogPage(page:PublishedSalesPageSummary):Promise<PublicCatalogEntry>{
 const data=await getPublishedSalesPage(page.plan_id);
 if(!data||data.headquarters_id!==page.headquarters_id)throw new Error('公開中の講座を確認できませんでした。');
 return {id:'page-'+page.plan_id,title:page.title,price:page.price,href:page.public_path,...courseCopy(data.courses,data.cover_image),availability:'before'};
}
export async function loadPublicHomepageCatalog(hq:string,supplied?:{pages?:PublishedSalesPageSummary[];offerings?:PublicOfferingSummary[]}){
 const lists=await Promise.allSettled([supplied?.pages??listPublishedSalesPages(hq),supplied?.offerings??listPublicOfferings({headquartersId:hq})]);
 if(lists.every(result=>result.status==='rejected'))throw new Error('講座の一覧を読み込めませんでした。');
 const pages=lists[0].status==='fulfilled'?lists[0].value:[];
 const offerings=lists[1].status==='fulfilled'?lists[1].value:[];
 let failures=lists.filter(result=>result.status==='rejected').length;
 // A known public summary remains useful when its detailed read fails. Never
 // infer that applications are open from a failed or incomplete response.
 const jobs=[...pages.map(p=>({read:()=>readPublicCatalogPage(p),fallback:{id:'page-'+p.plan_id,title:p.title,price:p.price,href:p.public_path,image:null,description:'',note:'',availability:'check' as const}})),...offerings.map(o=>({read:()=>readPublicCatalogOffering(o),fallback:{id:'offering-'+o.id,title:o.title,price:o.price,href:'/academy/o/'+o.id,image:null,description:'',note:'',availability:'check' as const}}))];
 let index=0;
 // Bound parallel reads when a headquarters has many published plans.
 const output=new Array<PublicCatalogEntry>(jobs.length);
 await Promise.all(Array.from({length:Math.min(4,jobs.length)},async()=>{while(index<jobs.length){const i=index++;try{output[i]=await jobs[i].read();}catch{failures++;output[i]=jobs[i].fallback;}}}));
 return {entries:output,partial:failures>0};
}
