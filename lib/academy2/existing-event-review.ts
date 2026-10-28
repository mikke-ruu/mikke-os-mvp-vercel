import {supabase} from '@/lib/supabase/client';
import type {EventKitSettings} from './operations';

/** Read-only prospective settings, never a saved event or a publication permit. */
export type ExistingEventReview = {
  source:'legacy_first_review';headquarters_id:string;event_id:string;event_revision:number;
  plan_id:string;current_plan_revision:number;review_plan_revision:number;course_id:string;
  configuration:{title:string;study_style:'instructor';allowed_methods:('online'|'in_person')[];kit:EventKitSettings};
};
export async function getExistingEventReview(headquartersId:string,eventId:string):Promise<ExistingEventReview|null>{
  const {data,error}=await supabase.rpc('academy2_existing_event_review',{p_hq:headquartersId,p_event:eventId}).abortSignal(AbortSignal.timeout(30000));
  if(error)throw Object.assign(new Error(error.code==='42501'?'この開催の見直しを確認する権限がありません。':'見直した販売プランの設定を確認できませんでした。入力内容は残っています。'),{code:error.code});
  if(data===null)return null;
  const value=data as ExistingEventReview;
  if(!value||value.source!=='legacy_first_review'||value.headquarters_id!==headquartersId||value.event_id!==eventId
    ||!Number.isInteger(value.event_revision)||value.event_revision<1||!Number.isInteger(value.current_plan_revision)||value.current_plan_revision<1
    ||!Number.isInteger(value.review_plan_revision)||value.review_plan_revision<=value.current_plan_revision
    ||!value.plan_id||!value.course_id||value.configuration?.study_style!=='instructor'
    ||!Array.isArray(value.configuration.allowed_methods)||!value.configuration.allowed_methods.length
    ||value.configuration.allowed_methods.some(method=>!['online','in_person'].includes(method))
    ||typeof value.configuration.kit?.enabled!=='boolean'||value.configuration.kit.contract_version!==2
    ||!Array.isArray(value.configuration.kit.methods)||value.configuration.kit.methods.some(method=>!['shipping','venue_handover'].includes(method)))
    throw new Error('見直した販売プランの保存状態を確認できませんでした。保存済みの開催は変更していません。');
  return value;
}
