import {supabase} from '@/lib/supabase/client';
import {assertAcademyWritable} from '@/lib/academy/preview';
import type {BankPreference} from './setup-progress';
async function call(hq:string,expected?:number,useBank?:boolean):Promise<BankPreference>{
 if(expected!==undefined)assertAcademyWritable();
 const {data,error}=await supabase.rpc('academy2_setup_bank_preference' as never,{p_hq:hq,p_expected:expected??null,p_use_bank:useBank??null} as never).abortSignal(AbortSignal.timeout(20000));
 if(error)throw Object.assign(new Error(error.code==='PT409'?'別の変更が保存されています。再取得して確認してください。':'お支払いの設定状況を確認できませんでした。'),{code:error.code});
 const v=data as BankPreference;
 if(!v||!Number.isSafeInteger(v.revision)||v.revision<0||![null,true,false].includes(v.useBank)||(v.revision===0)!==(v.useBank===null))throw new Error('お支払いの保存状態を確認できませんでした。');return v;
}
export const getSetupBankPreference=(hq:string)=>call(hq);
export const saveSetupBankPreference=(hq:string,expected:number,useBank:boolean)=>call(hq,expected,useBank);
