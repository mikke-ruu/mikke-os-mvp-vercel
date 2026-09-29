import {supabase} from '@/lib/supabase/client';
import {assertAcademyWritable} from '@/lib/academy/preview';
export type PlanConditionKind='completion'|'skill'|'commercial'|'instructor'|'manual'|'monthly_exit';
export type PlanConditionDocument={id:string;headquarters_id:string;kind:PlanConditionKind;title:string;version:string;body:string;created_at:string};
function failure(){return new Error('条件文書を処理できませんでした。権限と入力内容を確認してください。');}
export async function listPlanConditions(hq:string,kind:PlanConditionKind):Promise<PlanConditionDocument[]>{const {data,error}=await supabase.rpc('academy2_plan_conditions',{p_headquarters_id:hq,p_kind:kind}).abortSignal(AbortSignal.timeout(30_000));if(error)throw failure();return data as PlanConditionDocument[];}
export async function registerPlanCondition(hq:string,id:string,kind:PlanConditionKind,title:string,version:string,body:string):Promise<PlanConditionDocument>{assertAcademyWritable();const {data,error}=await supabase.rpc('academy2_register_plan_condition',{p_headquarters_id:hq,p_id:id,p_kind:kind,p_title:title,p_version:version,p_body:body}).abortSignal(AbortSignal.timeout(30_000));if(error)throw failure();return data as PlanConditionDocument;}

