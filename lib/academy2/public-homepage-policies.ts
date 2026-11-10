import {academyPublicClient} from '@/lib/academy/public-client';
import {listPublicOfferings} from '@/lib/academy/public-offerings';
import type {PublicSellerDisclosure} from './seller-disclosure';
export type PublicPolicySource={id:string;title:string;terms:string;seller:PublicSellerDisclosure|null};
/** Public snapshots only. Never read headquarters settings or document drafts. */
export async function loadPublicHomepagePolicies(hq:string):Promise<PublicPolicySource[]>{
 const offerings=await listPublicOfferings({headquartersId:hq});
 const results:PublicPolicySource[]=new Array(offerings.length);let index=0;
 await Promise.all(Array.from({length:Math.min(4,offerings.length)},async()=>{while(index<offerings.length){const i=index++,o=offerings[i];
  const [seller,intake]=await Promise.all([
   academyPublicClient.rpc('academy2_public_seller_disclosure',{p_offering:o.id}).abortSignal(AbortSignal.timeout(20000)),
   academyPublicClient.rpc('academy2_public_intake_with_form',{p_id:o.id,p_instructor:false}).abortSignal(AbortSignal.timeout(20000)),
  ]);
  if(seller.error||intake.error)throw new Error('公開中の規約を読み込めませんでした。');
  if(seller.data&&seller.data.offering_id!==o.id)throw new Error('販売者情報を確認できませんでした。');
  const data=intake.data;
  const terms=data?.mode==='headquarters'&&data.offering?.headquarters_id===hq&&data.offering?.id===o.id&&typeof data.terms?.body==='string'?data.terms.body:'';
  results[i]={id:o.id,title:o.title,terms,seller:seller.data as PublicSellerDisclosure|null};
 }}));return results;
}
