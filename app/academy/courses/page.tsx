"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { AcademyCatalogList } from "@/components/academy/AcademyCatalogList";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { getMyAcademyCourseCreationAccess } from "@/lib/academy/course-creation-access";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { listCourses } from "@/lib/academy/courses";
import type { AcademyCourse, AcademyHeadquarters } from "@/types/database";

function CoursesContent() {
 const { profile } = useAuth();
 const [hq,setHq]=useState<AcademyHeadquarters|null>(null);
 const [courses,setCourses]=useState<AcademyCourse[]>([]);
 const [createAccess,setCreateAccess]=useState<{allowed:boolean;reason:string|null}|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try {
   const foundHq=await getOwnedHeadquarters(profile.user_id);setHq(foundHq);
   if(foundHq){const [foundCourses,access]=await Promise.all([listCourses(foundHq.id),getMyAcademyCourseCreationAccess(foundHq.id)]);setCourses(foundCourses);setCreateAccess(access);}
   else {setCourses([]);setCreateAccess(null);}
  }catch{setError("講座を読み込めませんでした。");}finally{setLoading(false);}
 },[profile.user_id]);
 useEffect(()=>{void load();},[load]);
 if(loading)return <p className="py-10 text-center text-sm">読み込み中…</p>;
 if(error)return <div role="alert"><p>{error}</p><button type="button" onClick={()=>void load()}>再読み込み</button></div>;
 if(!hq)return <p className="py-8 text-sm">本部がまだありません。Academyのホームから本部を作成してください。</p>;
 return <AcademyCatalogList kind="course" createHref={createAccess?.allowed?toCurrentAcademyContextHref("/academy/courses/new"):undefined} createDisabledReason={createAccess?.reason} items={courses.map(course=>({
  id:course.id,title:course.name,category:course.feature_settings?.marketing?.category||"カテゴリーなし",
  image:course.feature_settings?.marketing?.images?.[0]||course.main_image_url,
  summary:`${course.duration_text||"時間未設定"} · ¥${Number(course.price).toLocaleString("ja-JP")} · ${course.feature_settings?.marketing?.curriculum?.filter(item=>item.trim()).length??0}レッスン`,
  duplicateHref:createAccess?.allowed?toCurrentAcademyContextHref(`/academy/courses/new?duplicate=${course.id}`):undefined,
  offeringHref:toCurrentAcademyContextHref(`/academy/offerings/new?courseId=${course.id}`),
  editHref:toCurrentAcademyContextHref(`/academy/courses/${course.id}`)
 }))}/>;
}
export default function CoursesPage(){return <HonbuShell title="講座一覧"><CoursesContent/></HonbuShell>;}
