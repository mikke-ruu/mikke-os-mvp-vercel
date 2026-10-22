import {supabase} from '@/lib/supabase/client';
import {assertAcademyWritable} from '@/lib/academy/preview';
import type {Academy2EventDetail,Academy2EventInput} from './operations';
export type MaterialMethod='none'|'venue_handover'|'learner_shipping'|'designated_shipping';
export type MaterialDestination={recipient_name:string;postal_code:string;address:string};
export type MaterialFulfillment={method:MaterialMethod;revision?:number;destination?:MaterialDestination|null;status?:'not_required'|'preparing'|'shipped';shipped_at?:string|null;tracking_number?:string|null};
export const materialMethodLabels:Record<MaterialMethod,string>={none:'物品なし',venue_handover:'当日、会場で手渡し',learner_shipping:'受講者本人へ事前発送',designated_shipping:'会場・担当者など指定先へ発送'};
async function call<T>(name:string,args:Record<string,unknown>):Promise<T>{
 const {data,error}=await supabase.rpc(name,args).abortSignal(AbortSignal.timeout(15000));
 if(error){
  const messages:Record<string,string>={
   academy2_invalid_destination:'指定先の宛名・郵便番号・住所を確認してください。',
   academy2_unused_destination:'この受け渡し方法では指定先住所を保存しません。受け渡し方法を確認してください。',
   academy2_invalid_fulfillment:'講座の物品設定と、開催方法・受け渡し方法の組み合わせを確認してください。',
   academy2_fulfillment_locked:'受付中または申込済みの開催では、物品の受け渡し条件を変更できません。',
   academy2_materials_version_required:'販売プランの物品設定を確認してください。旧設定は講座・販売プランの詳細画面で確認できます。',
   academy2_invalid_event:'開催名・日時・定員・受講方法・オンライン参加URLを確認してください。',
   academy2_invalid_event_field:'現在の保存契約に対応していない開催項目が含まれています。',
   academy2_invalid_event_field_type:'開催日時と定員などの入力形式を確認してください。',
   academy2_invalid_kit_method:'保存済み販売プランで利用できる受け渡し方法を確認してください。',
   academy2_event_identity_immutable:'保存済み開催の販売プランや講座は変更できません。',
  };
  throw Object.assign(new Error(error.code==='42501'?'この情報を扱う権限がありません。':error.code==='PT409'?'別の変更が保存されています。入力を残して最新の状態を確認してください。':messages[error.message]??(error.code==='22023'?'開催内容または受け渡し条件を確認してください。入力内容は残っています。':'保存・取得を確認できませんでした。入力内容は残っています。')),{code:error.code,reason:error.message});
 }
 return data as T;
}
export function readEventMaterials(hq:string,event:string){return call<MaterialFulfillment|null>('academy2_event_materials',{p_hq:hq,p_event:event});}
export function writeEventMaterials(hq:string,event:string|null,expected:number,request:string,input:Academy2EventInput&{planId?:string;planRevision?:number;courseId?:string},fulfillment:MaterialFulfillment,individual=false){
 assertAcademyWritable();
 const value={title:input.title,schedule_mode:input.scheduleMode,starts_at:input.startsAt,ends_at:input.endsAt,format:input.format,capacity:input.capacity,venue_name:input.venueName??null,meeting_url:input.meetingUrl??null,...(!event?{plan_id:input.planId,plan_revision:input.planRevision,course_id:input.courseId}:{})};
 return call<Academy2EventDetail&{fulfillment:MaterialFulfillment}>(individual?'academy2_write_individual_event_materials':'academy2_write_event_materials',{p_hq:hq,p_event:event,p_expected:expected,p_request:request,p_input:value,p_fulfillment:{method:fulfillment.method,...(fulfillment.method==='designated_shipping'?{destination:fulfillment.destination}:{})}});
}

export function recordEventMaterialShipping(hq:string,event:string,expected:number,request:string,tracking:string){
 assertAcademyWritable();
 return call<MaterialFulfillment>('academy2_record_event_material_shipping',{p_hq:hq,p_event:event,p_expected:expected,p_request:request,p_tracking:tracking.trim()||null});
}
export function matchesMaterialFulfillment(saved:MaterialFulfillment|null|undefined,input:MaterialFulfillment){
 if(saved?.method!==input.method)return false;
 if(input.method!=='designated_shipping')return !saved.destination;
 return (['recipient_name','postal_code','address'] as const).every(key=>saved.destination?.[key]===input.destination?.[key]);
}
