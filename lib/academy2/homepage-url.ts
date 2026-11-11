import {supabase} from '@/lib/supabase/client';
import {assertAcademyWritable} from '@/lib/academy/preview';
export type HomepageUrlSettings={headquartersId:string;canonicalHandle:string;preferredHandle:string;revision:number;canEdit:boolean};
export const homepageUrlHandleValid=(value:string)=>/^[a-z0-9][a-z0-9_-]{1,38}[a-z0-9]$/.test(value)&&!['admin','api','new','edit','settings','setup','login','logout','create','preview','support','academy','site','null','undefined'].includes(value);
export const homepageUrlPath=(handle:string)=>'/academy/site/'+encodeURIComponent(handle);
async function call(hq:string,current?:HomepageUrlSettings,handle?:string):Promise<HomepageUrlSettings>{
 if(current){assertAcademyWritable();if(!homepageUrlHandleValid(handle??''))throw new Error('URL名は3〜40文字の半角英数字・ハイフン・アンダーバーで入力してください。');}
 const {data,error}=await supabase.rpc('academy2_homepage_url_settings' as never,{p_hq:hq,p_expected_revision:current?.revision??null,p_expected_canonical:current?.canonicalHandle??null,p_handle:handle??null} as never).abortSignal(AbortSignal.timeout(20000));
 if(error)throw Object.assign(new Error(error.code==='PT409'?'URLの設定が変更されています。最新の状態を確認してください。':error.code==='23505'?'このURL名は使われています。別の名前を入力してください。':error.code==='42501'?'URL名を変更する権限がありません。':error.code==='PGRST202'||error.code==='42883'?'URL名の変更は、この環境ではまだ準備中です。保存していません。':'URLの保存結果を確認できませんでした。再送せず、保存状態を確認してください。'),{code:error.code});
 const v=data as HomepageUrlSettings;
 if(!v||v.headquartersId!==hq||typeof v.canonicalHandle!=='string'||!v.canonicalHandle||typeof v.preferredHandle!=='string'||!v.preferredHandle||!Number.isSafeInteger(v.revision)||v.revision<0||typeof v.canEdit!=='boolean')throw new Error('URLの保存状態を確認できませんでした。');return v;
}
export const getHomepageUrlSettings=(hq:string)=>call(hq);
export const saveHomepageUrlSettings=(hq:string,current:HomepageUrlSettings,handle:string)=>call(hq,current,handle.trim().toLowerCase());
