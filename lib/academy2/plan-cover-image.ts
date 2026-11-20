export type PlanCoverImage = {mode:'auto'|'custom'|'none';url?:string};
type PhotoCourse={main_image_url?:string|null;image?:string|null};
const safe=(url:unknown):url is string=>typeof url==='string'&&url.length<=2048&&/^https?:\/\//i.test(url);
/** Use only the supplied draft or public snapshot. Never read a private draft for a public page. */
export function resolvePlanCoverImage(value:unknown,courses:readonly PhotoCourse[]):{url:string|null;source:'course'|'custom'|'none'}{
 if(value&&typeof value==='object'){
  const cover=value as PlanCoverImage;
  if(cover.mode==='none')return {url:null,source:'none'};
  if(cover.mode==='custom')return {url:safe(cover.url)?cover.url:null,source:safe(cover.url)?'custom':'none'};
  if(cover.mode!=='auto')return {url:null,source:'none'};
 }
 const url=courses.length===1?(courses[0].main_image_url||courses[0].image):null;
 return {url:safe(url)?url:null,source:safe(url)?'course':'none'};
}
