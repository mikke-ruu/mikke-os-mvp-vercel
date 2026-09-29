import {supabase} from '@/lib/supabase/client';
import {assertAcademyWritable} from '@/lib/academy/preview';
export const SIX_STEP_REVIEW_PLAN='6c75ecb9-4e23-41f9-bd5f-7f106a18b99e';
export type CourseShipping={enabled:boolean;name:string;contents:string;shipping:boolean;handover:boolean};
export type CourseShippingRow={course_id:string;revision:number;configuration:CourseShipping|null};
async function call<T>(name:string,args:Record<string,unknown>):Promise<T>{const {data,error}=await supabase.rpc(name,args).abortSignal(AbortSignal.timeout(15000));if(error)throw new Error(error.code==='PT409'?'別の変更が保存されています。入力を控えて最新の設定を確認してください。':error.code==='42501'?'この設定を扱う権限がありません。':error.message==='academy2_shipping_unconfigured'?'選択した講座の発送物設定を保存してください。':error.message==='academy2_card_contract_required'?'Academyカード決済の契約・接続状態を確認してください。':'設定を処理できませんでした。入力内容は残しています。');return data as T;}
export const readCourseShipping=(hq:string,ids:string[])=>call<CourseShippingRow[]>('academy2_course_shipping',{p_hq:hq,p_courses:ids});
export function saveCourseShipping(hq:string,id:string,revision:number,value:CourseShipping){assertAcademyWritable();return call<CourseShippingRow>('academy2_save_course_shipping',{p_hq:hq,p_course:id,p_expected:revision,p_configuration:value});}
export function deriveCourseKit(rows:CourseShippingRow[],legacy?:unknown){
 if(rows.some(r=>!r.configuration))return null;
 const enabled=rows.filter(r=>r.configuration?.enabled),methods:('shipping'|'venue_handover')[]=[];
 if(enabled.length&&enabled.every(r=>r.configuration!.shipping))methods.push('shipping');
 if(enabled.length&&enabled.every(r=>r.configuration!.handover))methods.push('venue_handover');
 return {enabled:enabled.length>0,name:enabled.map(r=>r.configuration!.name).join('・'),recipient:'learner' as const,methods,course_source:rows.map(r=>({course_id:r.course_id,revision:r.revision,configuration:r.configuration})),...(legacy?{previous_plan_settings:legacy}:{})};
}
