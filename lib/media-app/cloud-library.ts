import {supabase} from "@/lib/supabase/client";
import type {LibraryRecord} from "@/lib/mikkeos/content/local-library";
import type {MediaCollection} from "@/components/media-app/MediaCollections";
async function verify(subject:string){const {data,error}=await supabase.auth.getUser();if(error||!data.user||data.user.is_anonymous||data.user.id!==subject)throw Error("ログイン状態が変わりました。ページを開き直してください。");}
export async function listCloudCollections(siteId:string,subject:string):Promise<LibraryRecord<MediaCollection>[]>{
 await verify(subject);const {data,error}=await supabase.from("media_collections").select("id,name,article_ids,created_at").eq("site_id",siteId).order("created_at");if(error)throw error;await verify(subject);
 return (data??[]).map(row=>({id:row.id,name:row.name,kind:"collection",scope:siteId,createdAt:row.created_at,value:{articleIds:row.article_ids}}));
}
export async function saveCloudCollection(siteId:string,subject:string,name:string,ids:string[],id?:string){await verify(subject);const {error}=await supabase.rpc("media_save_collection",{p_site_id:siteId,p_name:name,p_article_ids:ids,p_id:id??null});if(error)throw error;await verify(subject);}
export async function saveCloudOrder(subject:string,id:string,input:{date?:string;direction?:number;pinned?:boolean}){await verify(subject);const {error}=await supabase.rpc("media_update_publication_order",{p_article_id:id,p_date:input.date?new Date(input.date).toISOString():null,p_direction:input.direction??null,p_pinned:input.pinned??null});if(error)throw error;await verify(subject);}
