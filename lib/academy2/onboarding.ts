import {supabase} from '@/lib/supabase/client';

/** Real RPC only: local display previews must never grant a creation entry. */
export async function getAcademy2FreeCreationEntryAvailable():Promise<boolean>{
 const {data,error}=await supabase.rpc('academy_no_operating_fee_onboarding_available' as never);
 if(error||typeof data!=='boolean')throw new Error('本部を作成できる状態か確認できませんでした。');
 return data===true;
}

export async function getAcademy2OnboardingStatus(headquartersId:string):Promise<{basicSaved:boolean;hasEvent:boolean}>{
 const {data,error}=await supabase.rpc('academy2_onboarding_status' as never,{p_headquarters_id:headquartersId} as never);
 const value=data as {headquarters_id?:string;basic_saved?:boolean;has_event?:boolean}|null;
 if(error||value?.headquarters_id!==headquartersId||typeof value.basic_saved!=='boolean')throw new Error('初回設定の保存状態を確認できませんでした。');
 if(typeof value.has_event!=='boolean')throw new Error('開催の保存状態を確認できませんでした。');
 return {basicSaved:value.basic_saved,hasEvent:value.has_event};
}
