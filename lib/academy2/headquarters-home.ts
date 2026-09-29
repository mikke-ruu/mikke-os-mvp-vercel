import { supabase } from '@/lib/supabase/client';
import type { HeadquartersApplicationSummary } from './headquarters-applications';
import type { Academy2EventSummary } from './operations';
export type HeadquartersHomeData = {
 headquartersId:string;observedAt:string;month:string;name:string;heroImageUrl:string|null;logoUrl:string|null;publicHomepagePath:string|null;accessStatus:string|null;instructorCount:number|null;publishedPageCount:number;
 setup:{course:boolean;plan:boolean;page:boolean;published:boolean};
 permissions:{operations:boolean;finance:boolean;editCourses:boolean;editPages:boolean};
 notices:{id:string;title:string;detail:string;path:string}[];
 applications:HeadquartersApplicationSummary[]|null;events:Academy2EventSummary[]|null;
 monthly:{month:string;salesYen:number|null;applications:number|null}[]|null;
 upcoming:{id:string;title:string;detail:string;path:string}[];
};
export async function getHeadquartersHome(headquartersId:string,month:string):Promise<HeadquartersHomeData>{
 if(!/^\d{4}-\d{2}$/.test(month))throw new Error('表示する月を確認してください。');
 const {data,error}=await supabase.rpc('academy2_headquarters_home',{p_headquarters_id:headquartersId,p_month:month+'-01'}).abortSignal(AbortSignal.timeout(30_000));
 if(error)throw new Error(error.code==='42501'?'この本部のホームを確認する権限がありません。':'本部ホームを読み込めませんでした。もう一度お試しください。');
 if(!data||data.headquartersId!==headquartersId||data.month!==month||!data.permissions||!Array.isArray(data.notices)||!Array.isArray(data.upcoming)||!Number.isSafeInteger(data.publishedPageCount)||data.publishedPageCount<0||!(data.instructorCount===null||Number.isSafeInteger(data.instructorCount)&&data.instructorCount>=0)||!(data.applications===null||Array.isArray(data.applications))||!(data.events===null||Array.isArray(data.events))||!(data.monthly===null||Array.isArray(data.monthly)))throw new Error('本部ホームの情報を確認できませんでした。');
 if(data.permissions.operations&&(!Array.isArray(data.applications)||!Array.isArray(data.events)) || (data.permissions.finance||data.permissions.operations)&&(!Array.isArray(data.monthly)||data.monthly.length!==6))throw new Error('本部ホームの集計を確認できませんでした。');
 if(data.monthly?.some((row:{salesYen:number|null;applications:number|null})=>data.permissions.finance&&(!Number.isSafeInteger(row.salesYen)||row.salesYen!<0)||data.permissions.operations&&(!Number.isSafeInteger(row.applications)||row.applications!<0)))throw new Error('本部ホームの集計値を確認できませんでした。');
 return data as HeadquartersHomeData;
}
export function tokyoDate(value:string|Date){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
export function shiftMonth(month:string,amount:number){const [y,m]=month.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+amount,1));return d.toISOString().slice(0,7);}
export function monthCells(month:string){const [y,m]=month.split('-').map(Number);const first=new Date(Date.UTC(y,m-1,1));const offset=(first.getUTCDay()+6)%7;const days=new Date(Date.UTC(y,m,0)).getUTCDate();return Array.from({length:Math.ceil((offset+days)/7)*7},(_,i)=>new Date(Date.UTC(y,m-1,i-offset+1)).toISOString().slice(0,10));}

