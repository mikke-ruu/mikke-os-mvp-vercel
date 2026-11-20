import { academyPublicClient } from '@/lib/academy/public-client';
import {supabase} from '@/lib/supabase/client';
import {getPublishedSalesPage} from './plan-publication';
export type CourseIntroduction = {
  id:string; name:string; subtitle:string|null; description:string|null;
  target_audience:string|null; duration_text:string|null; images:string[];
  physical_items:{enabled:boolean;name:string;contents:string}|null;
};
export async function getPublicCourseIntroduction(id:string,returnHref?:string|null):Promise<CourseIntroduction|null>{
 const {data,error}=await academyPublicClient.rpc('academy2_public_course_introduction',{p_course:id}).abortSignal(AbortSignal.timeout(15000));
 if(error)throw new Error('講座を読み込めませんでした。');
 if(data)return data as CourseIntroduction;
 // An information page can be public before enrollment opens. Read only its
 // published snapshot, never a draft or a manager's current course record.
 const path=safeAcademyReturnHref(returnHref??null)?.split(/[?#]/)[0];
 const match=path?.match(/^\/academy\/page\/([0-9a-f-]{36})$/i);
 if(!match)return null;
 const page=await getPublishedSalesPage(match[1]);
 const course=page?.courses.find(item=>item.id===id);
 return course?{id:course.id,name:course.name,subtitle:course.subtitle,description:course.description,
  target_audience:null,duration_text:course.duration_text,images:course.marketing?.images??(course.main_image_url?[course.main_image_url]:[]),physical_items:null}:null;
}
export async function getCourseIntroductionPreview(hq:string,id:string):Promise<CourseIntroduction|null>{
 const {data,error}=await supabase.rpc('academy2_course_introduction_preview',{p_hq:hq,p_course:id}).abortSignal(AbortSignal.timeout(15000));
 if(error)throw new Error(error.code==='42501'?'この講座を確認する権限がありません。':'講座を読み込めませんでした。');return data as CourseIntroduction|null;
}
/** Only same-site Academy return paths. Never use the parameter as an external redirect. */
export function safeAcademyReturnHref(value:string|null):string|null{
 if(!value||!value.startsWith('/academy/')||/[\\\u0000-\u001f]/.test(value))return null;
 try{const url=new URL(value,'https://academy.invalid');return url.origin==='https://academy.invalid'&&url.pathname.startsWith('/academy/')?url.pathname+url.search+url.hash:null;}catch{return null;}
}
export function courseIntroductionHref(id:string,returnHref?:string,previewHq?:string){
 const query=new URLSearchParams();if(returnHref)query.set('return',returnHref);if(previewHq)query.set('preview_hq',previewHq);
 return `/academy/course/${encodeURIComponent(id)}${query.size?'?'+query.toString():''}`;
}
