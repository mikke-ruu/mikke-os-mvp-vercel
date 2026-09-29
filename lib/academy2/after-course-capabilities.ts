import {supabase} from '@/lib/supabase/client';
export type AfterCourseCapabilities = {card_contract:'active'|'unverified';card_ready:boolean;local_review?:boolean};
/** Contract consent and provider readiness are separate server facts. No browser assertion grants access. */
export async function getAfterCourseCapabilities(headquartersId:string):Promise<AfterCourseCapabilities>{
 const {data,error}=await supabase.rpc('academy2_after_course_capabilities' as never,{p_hq:headquartersId} as never).abortSignal(AbortSignal.timeout(15000));
 if(error)throw new Error('カード決済の契約状態を確認できませんでした。料金設定は保留しています。');
 const v=data as unknown as AfterCourseCapabilities;
 if(!v||!['active','unverified'].includes(v.card_contract)||typeof v.card_ready!=='boolean')throw new Error('カード決済の契約状態を確認できませんでした。');
 return v;
}
