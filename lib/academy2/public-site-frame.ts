import type {AcademyLpBlock} from '@/types/database';
import {academyPublicClient} from '@/lib/academy/public-client';
export type PublicSiteIdentity={id:string;handle:string;name:string;tagline:string|null;front_message:string|null;logo_url?:string|null;contact_email:string|null;front_blocks:AcademyLpBlock[]};
export async function readPublicSiteIdentity(hq:string):Promise<PublicSiteIdentity|null>{
 const {data,error}=await academyPublicClient.rpc('academy2_public_site_frame',{p_headquarters_id:hq}).abortSignal(AbortSignal.timeout(20000));
 if(error)throw new Error('本部の公開情報を読み込めませんでした。');
 if(data===null)return null;
 if(data.id!==hq||typeof data.handle!=='string'||typeof data.name!=='string'||!Array.isArray(data.front_blocks))throw new Error('本部の公開情報を確認できませんでした。');
 return data as PublicSiteIdentity;
}
