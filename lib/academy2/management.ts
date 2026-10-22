import {supabase} from '@/lib/supabase/client';
import {assertAcademyWritable} from '@/lib/academy/preview';
export type ManagementKind='course'|'plan'|'event';
export type ManagementState={id:string;revision:number;source_version:string;state:string;archived:boolean;can_delete:boolean;delete_reason:string;allowed_actions:string[]};
async function call<T>(name:string,args:Record<string,unknown>):Promise<T>{
 const {data,error}=await supabase.rpc(name,args);
 if(error)throw new Error(error.code==='42501'?'この操作を行う権限がありません。':error.code==='PT409'?'別の変更が保存されています。最新の状態を確認してください。':error.message==='academy2_management_referenced'?'保存履歴や関連データがあるため削除できません。アーカイブを使用してください。':error.message==='academy2_management_publication_hold'?'公開条件を満たしていません。販売プランと開催の設定を確認してください。':'操作を完了できませんでした。状態を確認してから再度お試しください。');
 return data as T;
}
export function getAcademy2Management(hqId:string,kind:ManagementKind,id:string):Promise<ManagementState>{return call('academy2_management',{p_headquarters_id:hqId,p_kind:kind,p_id:id});}
export function actAcademy2Management(hqId:string,kind:ManagementKind,id:string,action:string,expectedRevision:number,requestId:string,sourceVersion:string=''):Promise<ManagementState>{
 assertAcademyWritable();return call('academy2_management_command',{p_headquarters_id:hqId,p_kind:kind,p_id:id,p_action:action,p_expected_revision:expectedRevision,p_request_id:requestId,p_source_version:sourceVersion});
}
