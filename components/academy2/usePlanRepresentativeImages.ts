'use client';
import {useEffect,useState} from 'react';
import {listSalesPlanCatalog} from '@/lib/academy2/sales-plan-catalog';
import {listAcademy2Courses} from '@/lib/academy2/courses';
import {resolvePlanCoverImage} from '@/lib/academy2/plan-cover-image';

/** Decorative management images only. A missing image never blocks operational data. */
export function usePlanRepresentativeImages(headquartersId:string|undefined,retry=0){
 const [state,setState]=useState<{hq:string;images:Record<string,string|null>}|null>(null);
 useEffect(()=>{
  if(!headquartersId)return;
  let live=true;
  void Promise.allSettled([listSalesPlanCatalog(headquartersId),listAcademy2Courses(headquartersId)]).then(([plans,courses])=>{
   if(!live||plans.status!=='fulfilled')return;
   const courseImages=new Map(courses.status==='fulfilled'?courses.value.map(course=>[course.id,course.main_image_url]):[]);
   const images:Record<string,string|null>={};
   for(const plan of plans.value)images[plan.id]=resolvePlanCoverImage(plan.configuration.cover_image,plan.configuration.course_ids.map(id=>({main_image_url:courseImages.get(id)}))).url;
   setState({hq:headquartersId,images});
  });
  return()=>{live=false;};
 },[headquartersId,retry]);
 return state&&state.hq===headquartersId?state.images:{};
}
