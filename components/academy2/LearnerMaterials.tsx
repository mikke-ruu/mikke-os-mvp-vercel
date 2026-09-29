"use client";
import {useEffect,useState} from 'react';
import {useAuth} from '@/components/AuthGate';
import {AcademyLessonContent} from '@/components/academy/AcademyLessonContent';
import {supabase} from '@/lib/supabase/client';
import type {AcademyPageBlock} from '@/types/database';
type Materials={applicationId:string;planName:string;courses:{courseId:string;courseName:string;materialRevision:number;blocks:AcademyPageBlock[]}[]};
export function LearnerMaterials({applicationId}:{applicationId:string}){
 const {user}=useAuth();const [data,setData]=useState<Materials|null>(null);const [error,setError]=useState('');
 useEffect(()=>{let live=true;setData(null);setError('');void Promise.resolve(supabase.rpc('academy2_my_materials',{p_application_id:applicationId})).then(({data,error})=>{if(!live)return;if(error){setError('この教材は現在表示できません。申込時のアカウントとお支払い状況をご確認ください。');return;}setData(data as Materials);}).catch(()=>{if(live)setError('教材を読み込めませんでした。もう一度お試しください。');});return()=>{live=false;};},[applicationId,user.id]);
 if(error)return <p role="alert" className="py-8 text-sm">{error}</p>;
 if(!data)return <p role="status" className="py-8 text-sm">教材を読み込んでいます…</p>;
 return <div className="mx-auto max-w-3xl space-y-4">{data.courses.map(course=><section key={course.courseId} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-6"><h2 className="text-base font-bold text-[var(--mikke-text)]">{course.courseName}</h2><div className="mt-3 rounded-xl bg-[var(--mikke-surface-soft)] p-4 md:p-5"><AcademyLessonContent blocks={course.blocks}/></div></section>)}</div>;
}
