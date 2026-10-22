import { supabase } from '@/lib/supabase/client';
import { assertAcademyWritable } from '@/lib/academy/preview';
import type { AcademyHeadquarters } from '@/types/database';
import {reviewStorageUrl} from './review-storage-url.mjs';
export type HeadquartersFront = Pick<AcademyHeadquarters,'id'|'name'|'handle'|'tagline'|'front_message'|'hero_image_url'|'contact_email'|'front_blocks'|'updated_at'> & {logo_url?:string|null;can_edit_identity?:boolean;homepage_revision?:number;published_revision?:number|null;publication_state?:'inherited'|'published'|'hidden';publicly_available?:boolean};
export type HeadquartersFrontInput = Pick<HeadquartersFront,'name'|'tagline'|'front_message'|'hero_image_url'|'contact_email'|'front_blocks'|'logo_url'>;
async function call(name:string,args:Record<string,unknown>,id:string):Promise<HeadquartersFront>{
 const {data,error}=await supabase.rpc(name,args).abortSignal(AbortSignal.timeout(30_000));
 if(error)throw new Error(error.code==='PT409'?'別の画面で更新されています。入力内容を控えてから、最新の保存状態を読み込んでください。':error.code==='42501'?'このホームページを操作する権限がありません。':error.message==='academy_access_inactive'?'現在の利用状態では保存できません。本部設定を確認してください。':'ホームページの保存状態を確認できませんでした。入力内容は残っています。');
 if(!data||data.id!==id||typeof data.name!=='string'||typeof data.handle!=='string'||typeof data.updated_at!=='string'||!Array.isArray(data.front_blocks))throw new Error('ホームページの保存状態を確認できませんでした。');
 return data as HeadquartersFront;
}
export const getHeadquartersFront=(id:string)=>call('academy2_homepage_editor',{p_hq:id},id);
export function saveHeadquartersFront(id:string,expected:string,input:HeadquartersFrontInput){
 assertAcademyWritable();
 const origin=typeof window==='undefined'?'':window.location.origin;
 const hero=reviewStorageUrl(input.hero_image_url,origin,process.env.NEXT_PUBLIC_ACADEMY_REVIEW_STORAGE_ORIGIN);
 const logo=reviewStorageUrl(input.logo_url??null,origin,process.env.NEXT_PUBLIC_ACADEMY_REVIEW_STORAGE_ORIGIN);
 return call('academy2_save_homepage_draft',{p_hq:id,p_expected:expected,p_input:{...input,hero_image_url:hero,logo_url:logo}},id);
}
export function publishHeadquartersFront(id:string,expected:string,publish:boolean){assertAcademyWritable();return call('academy2_publish_homepage',{p_hq:id,p_expected:expected,p_publish:publish},id);}
