import type { SupabaseClient } from '@supabase/supabase-js';
export type PartnerHistoryRate = {projectId:string;projectTitle:string;memberId:string;memberName:string;hourlyWage:number|null;calculationBasis:'scheduled'|'actual';status:'active'|'removed'};
export type PartnerHistoryLesson = {id:string|null;sessionId:string;projectId:string;projectTitle:string;memberId:string;date:string;startTime:string;minutes:number;role:'primary'|'training';status:'completed'|'cancelled'|'unconfirmed';hourlyWage:number|null;calculationBasis:'scheduled'|'actual';actualMinutes:number|null;amount:number|null};
export type PartnerHistory = {partnerName:string|null;rates:PartnerHistoryRate[];lessons:PartnerHistoryLesson[]};
export async function loadPartnerHistory(client:SupabaseClient,month:string,partnerId:string|null):Promise<PartnerHistory>{
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('月を選択してください。');
 const {data,error}=await client.rpc('team_works_partner_history',{target_partner:partnerId,month_start:`${month}-01`});
 if(error)throw new Error('履歴を読み込めませんでした。機能の準備状況やアクセス権を本部にご確認ください。');
 return data as PartnerHistory;
}
export function historyTotals(lessons:PartnerHistoryLesson[]){
 const completed=lessons.filter(row=>row.status==='completed');
 return {count:completed.length,minutes:completed.reduce((sum,row)=>sum+(row.calculationBasis==='actual'?(row.actualMinutes??0):row.minutes),0),amount:completed.reduce((sum,row)=>sum+(row.amount??0),0),unpriced:completed.filter(row=>row.amount===null).length};
}
export function parseHourlyWage(value:string):number|null{
 if(!value.trim())return null;
 const wage=Number(value);
 if(!Number.isInteger(wage)||wage<0||wage>2147483647)throw new Error('時給は0以上の整数で入力してください。');
 return wage;
}

export function parseActualMinutes(value:string):number{const minutes=Number(value);if(!value.trim()||!Number.isInteger(minutes)||minutes<0||minutes>1440)throw new Error('実稼働時間は0〜1440分の整数で入力してください。');return minutes;}
