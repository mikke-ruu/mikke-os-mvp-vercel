import { supabase } from '@/lib/supabase/client';
import type { SalesPlanDraft } from './sales-plan-drafts';
export type SalesPlanPublicationState={state:'not_published'|'published'|'archived'|'unavailable'|'unknown';offering_id:string|null;public_path:string|null;published_at:string|null;plan_revision:number|null;page_revision:number|null;has_unpublished_changes:boolean};
export type SalesPlanCatalogItem=SalesPlanDraft&{publication:SalesPlanPublicationState};
export async function listSalesPlanCatalog(headquartersId:string):Promise<SalesPlanCatalogItem[]>{
 const {data,error}=await supabase.rpc('academy2_sales_plan_catalog',{p_headquarters_id:headquartersId});
 if(error)throw new Error(error.code==='42501'?'この本部の販売プランを確認する権限がありません。':'販売プランの公開状態を読み込めませんでした。');
 return data as SalesPlanCatalogItem[];
}
