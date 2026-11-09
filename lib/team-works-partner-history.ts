import type { SupabaseClient } from '@supabase/supabase-js';
export type PartnerHistoryRate = {projectId:string;projectTitle:string;memberId:string;memberName:string;hourlyWage:number|null;calculationBasis:'scheduled'|'actual';status:'active'|'removed'};
export type PartnerHistoryLesson = {id:string|null;sessionId:string;projectId:string;projectTitle:string;memberId:string;date:string;startTime:string;minutes:number;role:'primary'|'training';status:'completed'|'cancelled'|'unconfirmed';hourlyWage:number|null;calculationBasis:'scheduled'|'actual';actualMinutes:number|null;actualStartTime?:string|null;actualEndTime?:string|null;actualEndNextDay?:boolean;actualBreakMinutes?:number;amount:number|null};
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

export function actualTimeMinutes(start:string,end:string,nextDay:boolean,breakText:string){
 const clock=(value:string)=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw new Error('開始・終了時刻を入力してください。');const [h,m]=value.split(':').map(Number);return h*60+m;};
 const elapsed=clock(end)-clock(start)+(nextDay?1440:0);
 if(elapsed<=0||elapsed>1440)throw new Error('終了は開始より後、24時間以内にしてください。日付をまたぐ場合は「翌日」を選んでください。');
 const rest=parseActualMinutes(breakText);
 if(rest>elapsed)throw new Error('休憩時間が開始から終了までの時間を超えています。');
 return elapsed-rest;
}
export function scheduledTimeRange(start:string,minutes:number){
 const [h,m]=start.split(':').map(Number);const total=h*60+m+minutes;
 return `${start.slice(0,5)}〜${total>=1440?'翌日 ':''}${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}
export function lessonTimeLabel(row:PartnerHistoryLesson){
 if(row.calculationBasis!=='actual')return `${scheduledTimeRange(row.startTime,row.minutes)}（${row.minutes}分）`;
 if(row.actualStartTime&&row.actualEndTime)return `${row.actualStartTime.slice(0,5)}〜${row.actualEndNextDay?'翌日 ':''}${row.actualEndTime.slice(0,5)}（実働${row.actualMinutes??0}分${row.actualBreakMinutes?`・休憩${row.actualBreakMinutes}分`:''}）`;
 return row.actualMinutes===null?'時間を確認中':`実働${row.actualMinutes}分（開始・終了時刻は未登録）`;
}
