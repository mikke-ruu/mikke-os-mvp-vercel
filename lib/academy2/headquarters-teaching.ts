import {supabase} from '@/lib/supabase/client';
export type HeadquartersTeachingEvent={id:string;title:string;startsAt:string|null;endsAt:string|null;format:string;venueName:string|null;meetingUrl:string|null;status:string;participants:{name:string}[]};
export async function getHeadquartersTeaching(hq:string):Promise<HeadquartersTeachingEvent[]>{
 const {data,error}=await supabase.rpc('academy2_my_hq_teaching',{p_headquarters_id:hq});
 if(error)throw new Error('担当する開催を読み込めませんでした。もう一度お試しください。');
 return data as HeadquartersTeachingEvent[];
}
