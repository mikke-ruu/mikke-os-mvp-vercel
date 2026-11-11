import {supabase} from '@/lib/supabase/client';
import {assertAcademyWritable} from '@/lib/academy/preview';
export type HomepagePreparation={reviewed:boolean;reviewedRevision:number|null;currentRevision:number;publiclyAvailable:boolean};
async function call(hq:string,expected?:number):Promise<HomepagePreparation>{
 if(expected!==undefined){assertAcademyWritable();if(!Number.isSafeInteger(expected)||expected<0)throw new Error('ホームページの保存状態を再取得してください。');}
 const {data,error}=await supabase.rpc('academy2_homepage_preparation' as never,{p_hq:hq,p_expected:expected??null} as never).abortSignal(AbortSignal.timeout(20000));
 if(error)throw Object.assign(new Error(error.code==='PT409'?'ホームページが更新されています。保存済みのページをもう一度確認してください。':'ホームページの確認状況を取得できませんでした。'),{code:error.code});
 const v=data as HomepagePreparation;
 if(!v||typeof v.reviewed!=='boolean'||typeof v.publiclyAvailable!=='boolean'||!Number.isSafeInteger(v.currentRevision)||v.currentRevision<0||!(v.reviewedRevision===null||Number.isSafeInteger(v.reviewedRevision)&&v.reviewedRevision>=0)||v.reviewed!==(v.reviewedRevision===v.currentRevision))throw new Error('ホームページの確認状況を取得できませんでした。');
 return v;
}
export const getHomepagePreparation=(hq:string)=>call(hq);
export const markHomepageReviewed=(hq:string,expectedHomepageRevision:number)=>call(hq,expectedHomepageRevision);
