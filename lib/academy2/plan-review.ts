import {supabase} from '@/lib/supabase/client';
import {assertAcademyWritable} from '@/lib/academy/preview';
export const SIX_STEP_REVIEW_PLAN='6c75ecb9-4e23-41f9-bd5f-7f106a18b99e';
export type CourseShipping={enabled:boolean;name:string;contents:string;shipping:boolean;handover:boolean;version?:2};
export type CourseShippingRow={course_id:string;revision:number;configuration:CourseShipping|null};
async function call<T>(name:string,args:Record<string,unknown>):Promise<T>{const {data,error}=await supabase.rpc(name,args).abortSignal(AbortSignal.timeout(15000));if(error)throw new Error(error.message==='読み取り専用の確認画面です。保存・アップロード・公開はできません。'?'このローカル確認環境では設定の取得・保存が制限されています。':error.code==='PT409'?'別の変更が保存されています。入力を控えて最新の設定を確認してください。':error.code==='42501'?'この設定を扱う権限がありません。':error.message==='academy2_shipping_unconfigured'?'選択した講座の発送物設定を保存してください。':error.message==='academy2_card_contract_required'?'Academyカード決済の契約・接続状態を確認してください。':'設定を処理できませんでした。入力内容は残しています。');return data as T;}
export async function readCourseShipping(hq:string,ids:string[]):Promise<CourseShippingRow[]> {
 if(!ids.length)return [];
 const rows=await call<CourseShippingRow[]>('academy2_course_shipping',{p_hq:hq,p_courses:ids});
 const configurationValid=(c:CourseShipping|null)=>c===null||!!c&&typeof c.enabled==='boolean'&&typeof c.name==='string'&&typeof c.contents==='string'&&typeof c.shipping==='boolean'&&typeof c.handover==='boolean';
 if(!Array.isArray(rows)||rows.length!==ids.length||new Set(rows.map(r=>r?.course_id)).size!==ids.length||rows.some(r=>!r||!ids.includes(r.course_id)||!Number.isInteger(r.revision)||r.revision<0||!configurationValid(r.configuration)))throw new Error('材料・教材を確認できませんでした。もう一度確認してください。');
 return ids.map(id=>rows.find(r=>r.course_id===id)!);
}
export function saveCourseShipping(hq:string,id:string,revision:number,value:CourseShipping){assertAcademyWritable();return call<CourseShippingRow>('academy2_save_course_shipping',{p_hq:hq,p_course:id,p_expected:revision,p_configuration:value});}
export function deriveCourseKit(rows:CourseShippingRow[],legacy?:unknown){
 if(rows.some(r=>!r.configuration))return null;
 const enabled=rows.filter(r=>r.configuration?.enabled),methods:('shipping'|'venue_handover')[]=[];
 if(enabled.length)methods.push('shipping');
 if(enabled.length)methods.push('venue_handover');
 return {contract_version:2 as const,enabled:enabled.length>0,name:enabled.map(r=>r.configuration!.name).join('・'),recipient:'learner' as const,methods,course_source:rows.map(r=>({course_id:r.course_id,revision:r.revision,configuration:r.configuration})),...(legacy?{previous_plan_settings:legacy}:{})};
}
