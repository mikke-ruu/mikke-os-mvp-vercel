import {parseMediaPublicArticles,type MediaPublicArticleSummaryDTO} from "./public-contract";
export type PublicMediaPageFilters={page:number;query:string;category:string;month:string;collection:string};
export type PublicMediaPageData={total:number;items:{article:MediaPublicArticleSummaryDTO;categories:string[];pinned:boolean;publicationOrder:number;displayDate:string}[]};
export function parsePublicMediaPage(value:unknown):PublicMediaPageData|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const v=value as Record<string,unknown>;
 if(Object.keys(v).sort().join(',')!=="items,total"||!Number.isSafeInteger(v.total)||Number(v.total)<0||!Array.isArray(v.items)||v.items.length>12)return null;
 for(const item of v.items){if(!item||typeof item!=="object"||Array.isArray(item)||Object.keys(item).sort().join(',')!=="article,categories,displayDate,pinned,publicationOrder"||!parseMediaPublicArticles([item.article])||!Array.isArray(item.categories)||item.categories.length>100||!item.categories.every((c:unknown)=>typeof c==="string"&&c.length<=60)||typeof item.pinned!=="boolean"||!Number.isInteger(item.publicationOrder)||typeof item.displayDate!=="string"||Number.isNaN(Date.parse(item.displayDate)))return null;}
 return value as PublicMediaPageData;
}
