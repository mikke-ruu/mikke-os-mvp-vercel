import {isPublicPaymentMethod,type PublicPaymentMethod} from './public-intake-payments';
export type PublicStageQuote={state:'ready'|'payment_pending'|'completion_pending'|'complete';stage_index:number;stage_count:number;course_id:string;course:{id?:string;course_id?:string;name?:string};price:number;payment_methods:PublicPaymentMethod[];external_payment_url?:string|null;last_application_id:string|null;completion_mode:'hq'};
export function readPublicStageQuote(value:unknown):PublicStageQuote|null{
 if(!value||typeof value!=='object')return null;
 const q=value as PublicStageQuote;
 if(!['ready','payment_pending','completion_pending','complete'].includes(q.state)||!Number.isInteger(q.stage_index)||!Number.isInteger(q.stage_count)||q.stage_index<1||q.stage_count<q.stage_index||typeof q.course_id!=='string'||!q.course_id||!q.course||typeof q.course!=='object'||(q.course.id??q.course.course_id)!==q.course_id||typeof q.price!=='number'||!Number.isFinite(q.price)||q.price<0||!Array.isArray(q.payment_methods)||!q.payment_methods.length||!q.payment_methods.every(isPublicPaymentMethod)||q.completion_mode!=='hq')return null;
 return q;
}
export function stagePurchaseState(quote:PublicStageQuote|null){
 return quote?{amount:quote.price,stage:quote.stage_index,courseName:quote.course.name??'',current:undefined,complete:quote.state==='complete',blocked:quote.state!=='ready'}:null;
}
export function viewerIntakeScope(id:string,instructor:boolean,userId:string|null){return `${id}:${instructor?'instructor':'headquarters'}:${userId??'anonymous'}`;}
export function scopedViewerData<T>(scope:string,entry:{scope:string;data:T}|null):T|null{return entry?.scope===scope?entry.data:null;}
