import {supabase} from '@/lib/supabase/client';
import {assertAcademyWritable} from '@/lib/academy/preview';

export type SellerDocument={business_type:''|'individual'|'corporation';legal_name:string;representative:string;postal_address:string;contact_phone:string;contact_email:string;inquiry_url:string;additional_fees:string;payment_deadline:string;provision_timing:string;publication_consent:boolean};
export type SellerProfile={can_edit:boolean;actor_id?:string;revision:number|null;document:SellerDocument|null;missing?:string[]};
export const emptySellerDocument:SellerDocument={business_type:'',legal_name:'',representative:'',postal_address:'',contact_phone:'',contact_email:'',inquiry_url:'',additional_fees:'',payment_deadline:'',provision_timing:'',publication_consent:false};
export const sellerFieldLabels:Record<string,string>={business_type:'事業者区分',legal_name:'販売事業者名',representative:'運営責任者',postal_address:'所在地',contact_phone:'電話番号',contact_email:'お問い合わせ先メールアドレス',inquiry_url:'お問い合わせ先URL',additional_fees:'受講料以外の費用',payment_deadline:'お支払いの期限',provision_timing:'受講・教材・物品の提供時期',publication_consent:'販売ページへの表示内容の確認',cancellation:'キャンセル・返金ポリシー',privacy:'プライバシーポリシー'};
export const sellerSignature=(value:SellerDocument)=>JSON.stringify(Object.keys(emptySellerDocument).sort().map(key=>[key,value[key as keyof SellerDocument]]));
async function call<T>(name:string,args:Record<string,unknown>):Promise<T>{
 const {data,error}=await supabase.rpc(name,args).abortSignal(AbortSignal.timeout(20_000));
 if(error)throw Object.assign(new Error(error.code==='PT409'?'別の変更が保存されています。入力内容を残して最新の内容を確認してください。':error.code==='42501'?'販売者情報は本部責任者が設定します。':error.code==='22023'?'入力内容を確認してください。入力した内容は残っています。':'販売者情報を確認できませんでした。時間をおいてもう一度お試しください。'),{code:error.code});
 return data as T;
}
function profile(value:SellerProfile){
 if(!value||typeof value.can_edit!=='boolean')throw new Error('販売者情報の保存状態を確認できませんでした。');
 if(value.can_edit&&(!Number.isSafeInteger(value.revision)||typeof value.actor_id!=='string'||value.document!==null&&(Object.keys(value.document).length!==Object.keys(emptySellerDocument).length||Object.entries(emptySellerDocument).some(([key,initial])=>typeof value.document?.[key as keyof SellerDocument]!==typeof initial))))throw new Error('販売者情報の形式を確認できませんでした。');
 return value;
}
export async function getSellerProfile(hq:string){return profile(await call<SellerProfile>('academy2_seller_profile',{p_hq:hq}));}
export async function saveSellerProfile(hq:string,expected:number,request:string,document:SellerDocument){assertAcademyWritable();return profile(await call<SellerProfile>('academy2_save_seller_profile',{p_hq:hq,p_expected:expected,p_request:request,p_document:document}));}
export type PublicSellerDisclosure=SellerDocument&{offering_id:string;offering_title:string;price:number;currency:string;payment_methods:string[];published_at:string;policies:Partial<Record<'commerce'|'cancellation'|'privacy',{body:string;version:string;revision:number}>>};
export function getPublicSellerDisclosure(offeringId:string){return call<PublicSellerDisclosure|null>('academy2_public_seller_disclosure',{p_offering:offeringId});}
