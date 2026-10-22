import {supabase} from '@/lib/supabase/client';
import {assertAcademyWritable} from '@/lib/academy/preview';
import type {HeadquartersApplicationDetail} from './headquarters-applications';
export type ApplicationSchedule={id?:string;startsAt:string|null;endsAt:string|null;mode?:string;individual?:boolean;state?:'consulting'|'confirmed'|'changed'};
export type IndividualSchedule={applicationId:string;eventId:string;startsAt:string|null;endsAt:string|null;revision:number;state:'consulting'|'confirmed'|'changed';updatedAt:string|null};
const date=(v:string,options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',hourCycle:'h23',...options}).format(new Date(v));
export function applicationScheduleLabel(s:ApplicationSchedule|null|undefined){
 if(!s)return '開催日程の指定なし';
 if(!s.startsAt)return s.individual?'個別日程相談・日程未確定':s.mode==='arranged_after_application'?'日程相談中（共有日程）':'日時未確定';
 if(!Number.isFinite(Date.parse(s.startsAt)))return '開催日時を確認してください';
 const full={year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'} as const;
 const sameDay=s.endsAt&&Number.isFinite(Date.parse(s.endsAt))&&date(s.startsAt,{year:'numeric',month:'numeric',day:'numeric'})===date(s.endsAt,{year:'numeric',month:'numeric',day:'numeric'});
 return date(s.startsAt,full)+(s.endsAt&&Number.isFinite(Date.parse(s.endsAt))?'〜'+date(s.endsAt,sameDay?{hour:'2-digit',minute:'2-digit'}:full):'')+(s.individual&&s.state==='changed'?'（日程変更あり）':'');
}
export async function confirmApplicationSchedule(hq:string,application:string,expected:number,request:string,starts:string,ends:string):Promise<HeadquartersApplicationDetail>{
 assertAcademyWritable();
 const {data,error}=await supabase.rpc('academy2_confirm_individual_schedule',{p_headquarters_id:hq,p_application_id:application,p_expected_revision:expected,p_request_id:request,p_starts_at:starts,p_ends_at:ends}).abortSignal(AbortSignal.timeout(30000));
 if(error)throw new Error(error.code==='42501'?'この申込の日程を変更する権限がありません。':error.message==='academy2_individual_slot_conflict'?'同じ募集の他の受講者と時間が重なっています。別の日時を確認してください。':error.code==='PT409'?'別の変更が保存されています。入力を残して最新の状態を読み込んでください。':error.message==='academy2_schedule_locked'?'修了済み・取消済みなど、現在の状態では日程を変更できません。':'日程を保存できませんでした。入力内容は残っています。');
 return data as HeadquartersApplicationDetail;
}


