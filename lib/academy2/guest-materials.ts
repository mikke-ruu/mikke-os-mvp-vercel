import {supabase} from '@/lib/supabase/client';

export type GuestMaterialApplication={applicationId:string;planName:string;appliedAt:string;claimed:boolean;state:'available'|'awaiting_payment'|'awaiting_completion'|'expired'|'unavailable'};
export const guestMaterialTokenKey=(id:string)=>'academy-guest-material:'+id.toLowerCase();
const receiptToken=(id:string|null)=>id?sessionStorage.getItem(guestMaterialTokenKey(id)):null;
const states=new Set(['available','awaiting_payment','awaiting_completion','expired','unavailable']);
async function call(name:string,args:Record<string,unknown>):Promise<GuestMaterialApplication[]>{
 const {data,error}=await supabase.rpc(name,args).abortSignal(AbortSignal.timeout(20000));
 if(error)throw new Error(error.code==='42501'?'お申し込みと同じメールアドレスでログインし、メールアドレスの確認を済ませてから開き直してください。':'教材の受け取り状況を確認できませんでした。もう一度お試しください。');
 if(!Array.isArray(data)||data.some(row=>!row||typeof row.applicationId!=='string'||typeof row.planName!=='string'||typeof row.appliedAt!=='string'||typeof row.claimed!=='boolean'||!states.has(row.state)))throw new Error('教材の受け取り状況を確認できませんでした。');
 return data;
}
export const listMyGuestMaterials=(applicationId:string|null=null,before?:{appliedAt:string;applicationId:string})=>call('academy2_my_guest_applications',{p_application_id:applicationId,p_before_at:before?.appliedAt??null,p_before_id:before?.applicationId??null,p_receipt_token:receiptToken(applicationId)});
export const claimMyGuestApplication=(applicationId:string)=>call('academy2_claim_guest_application',{p_application_id:applicationId,p_receipt_token:receiptToken(applicationId)});
