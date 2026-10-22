import {supabase} from '@/lib/supabase/client';
import {assertAcademyWritable} from '@/lib/academy/preview';
import {reviewStorageUrl} from './review-storage-url.mjs';

export type HeadquartersBranding={logo_url:string|null;hero_image_url:string|null;updated_at:string};

async function call(name:string,args:Record<string,unknown>):Promise<HeadquartersBranding>{
 const {data,error}=await supabase.rpc(name,args).abortSignal(AbortSignal.timeout(30_000));
 if(error)throw new Error(error.code==='PT409'?'別の画面で本部情報が更新されています。選択した画像は残っています。最新の保存状態を確認してください。':error.code==='42501'?'この本部の画像を変更する権限がありません。':error.code==='22023'?'この画像を保存できませんでした。選択した画像は残っています。':'画像の保存状態を確認できませんでした。選択した画像は残っています。');
 const value=data as HeadquartersBranding|null;
 if(!value||typeof value.updated_at!=='string')throw new Error('画像の保存状態を確認できませんでした。');
 return value;
}

export const getHeadquartersBranding=(id:string)=>call('academy2_headquarters_branding',{p_hq:id});
export function saveHeadquartersBranding(id:string,expected:string,logo:string|null,hero:string|null){
 assertAcademyWritable();
 const origin=typeof window==='undefined'?'':window.location.origin;
 const canonical=process.env.NEXT_PUBLIC_ACADEMY_REVIEW_STORAGE_ORIGIN;
 return call('academy2_save_headquarters_branding',{p_hq:id,p_expected:expected,p_logo:reviewStorageUrl(logo,origin,canonical),p_hero:reviewStorageUrl(hero,origin,canonical)});
}
