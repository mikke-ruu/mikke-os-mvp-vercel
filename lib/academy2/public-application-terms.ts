import {academyPublicClient} from '@/lib/academy/public-client';
import {supabase} from '@/lib/supabase/client';
/** The form reader uses the same current actor/quote as the form itself.
 * A continuing staged purchase must not be shown another public revision. */
export async function readPublicApplicationTerms(offeringId:string,fromApplication=false):Promise<{body:string;version:string}|null>{
 let data:{mode?:unknown;offering?:{id?:unknown}|null;terms?:{body?:unknown;version?:unknown}|null}|null=null;
 if(fromApplication){
  const response=await fetch('/api/academy2/course-stripe-candidate/quote',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({offeringId}),signal:AbortSignal.timeout(30000)});
  const quote=await response.json();
  if(!response.ok||typeof quote.enabled!=='boolean')throw new Error('申込規約を読み込めませんでした。');
  if(quote.enabled){if(quote.card_ready!==true||quote.card_provider!=='stripe_connect'||!['test','live'].includes(quote.card_mode))throw new Error('申込規約を確認できませんでした。');data=quote;}
 }
 if(!data){const result=await (fromApplication?supabase:academyPublicClient).rpc('academy2_public_intake_with_form',{p_id:offeringId,p_instructor:false}).abortSignal(AbortSignal.timeout(20000));if(result.error)throw new Error('申込規約を読み込めませんでした。');data=result.data;}
 if(data?.mode!=='headquarters'||data.offering?.id!==offeringId)return null;
 return typeof data.terms?.body==='string'&&typeof data.terms?.version==='string'?{body:data.terms.body,version:data.terms.version}:null;
}
