import {supabase} from '@/lib/supabase/client';
import {assertAcademyWritable} from '@/lib/academy/preview';
import {readCourseShipping,type CourseShippingRow} from './plan-review';
export type CoursePhysicalItems={enabled:boolean;name:string;contents:string};
export async function saveCoursePhysicalItems(hq:string,id:string,revision:number,value:CoursePhysicalItems):Promise<CourseShippingRow>{
 assertAcademyWritable();
 const {data,error}=await supabase.rpc('academy2_save_course_physical_items',{p_hq:hq,p_course:id,p_expected:revision,p_configuration:value}).abortSignal(AbortSignal.timeout(15000));
 if(error)throw new Error(error.code==='PT409'?'別の変更が保存されています。入力内容を残しています。':error.code==='42501'?'物品設定を保存する権限がありません。':'物品設定を保存できませんでした。入力内容を残しています。');
 const saved=data as CourseShippingRow;
 let verified:CourseShippingRow;
 try{[verified]=await readCourseShipping(hq,[id]);}catch(cause){throw Object.assign(new Error('物品設定の保存後の取得を確認できませんでした。入力内容を残しています。'),{savedRow:saved,cause});}
 if(!saved||saved.course_id!==id||verified.revision!==saved.revision||!verified.configuration||(verified.configuration as CoursePhysicalItems&{version?:number}).version!==2||verified.configuration.enabled!==value.enabled||verified.configuration.name!==value.name||verified.configuration.contents!==value.contents)throw Object.assign(new Error('物品設定の保存後の取得を確認できませんでした。入力内容を残しています。'),{savedRow:saved});
 return verified;
}
