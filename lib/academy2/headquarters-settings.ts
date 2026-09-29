import { supabase } from '@/lib/supabase/client';
import { assertAcademyWritable } from '@/lib/academy/preview';

export type HeadquartersDocumentKind = 'application'|'cancellation'|'privacy'|'commerce'|'instructor_contract';
export type HeadquartersBasic = {name:string;contact_email:string;tagline:string;default_payment_note:string;updated_at:string};
export type HeadquartersSettings = {
 basic:HeadquartersBasic;
 documents:{kind:HeadquartersDocumentKind;revision:number;version:string;body:string;saved_at:string}[];
 connect:null|{charges_enabled:boolean;payouts_enabled:boolean;verified_at:string;valid_until:string;ready:boolean};
 members:{handle:string|null;role:string;active:boolean}[];
 invitations:{id:string;role:string;channel:string;status:string;delivery_status:string;expires_at:string}[];
 billing:null|{access:null|{access_kind:string;status:string;starts_at:string;trial_ends_at:string|null;paid_started_at:string|null};estimate:null|{registered_instructor_count:number;catalog_price_yen:number;observed_at:string}};
};
async function call(name:string,args:Record<string,unknown>):Promise<HeadquartersSettings>{
 const {data,error}=await supabase.rpc(name as never,args as never).abortSignal(AbortSignal.timeout(30_000));
 if(error)throw Object.assign(new Error(error.code==='PT409'?'別の画面で更新されています。入力内容を控えてから、最新の保存状態を読み込んでください。':error.code==='42501'?'この設定を操作する権限がありません。':error.message==='academy2_document_version_required'?'本文を変更するときは、新しいバージョンを入力してください。':error.code==='22023'?'入力内容を確認してください。':error.message==='academy_access_inactive'?'現在の利用状態では本部情報を保存できません。利用料金の状態を確認してください。':'設定を確認できませんでした。入力内容は残っています。'),{code:error.code});
 const value=data as unknown as HeadquartersSettings;
 if(!value?.basic||typeof value.basic.name!=='string'||typeof value.basic.updated_at!=='string'||!Array.isArray(value.documents)||!Array.isArray(value.members))throw new Error('設定の保存状態を確認できませんでした。');
 return value;
}
export const getHeadquartersSettings=(id:string)=>call('academy2_headquarters_settings',{p_hq:id});
export function saveHeadquartersBasic(id:string,basic:HeadquartersBasic){assertAcademyWritable();const {updated_at,...input}=basic;return call('academy2_save_headquarters_basic',{p_hq:id,p_expected:updated_at,p_input:input});}
export function saveHeadquartersDocument(id:string,kind:HeadquartersDocumentKind,revision:number,version:string,body:string){assertAcademyWritable();return call('academy2_save_headquarters_document',{p_hq:id,p_kind:kind,p_expected:revision,p_version:version,p_body:body});}
