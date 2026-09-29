export type PublicPaymentMethod='bank'|'onsite'|'external'|'card';
export const publicPaymentLabels:Record<PublicPaymentMethod,string>={bank:'銀行振込',onsite:'現地でお支払い',external:'外部の決済ページでお支払い',card:'カード決済'};
export function isPublicPaymentMethod(value:string):value is PublicPaymentMethod{return Object.hasOwn(publicPaymentLabels,value);}
export function safeExternalPaymentUrl(value:unknown):string|null{
 if(typeof value!=='string'||!value||/[\s\u0000-\u001f\u007f]/u.test(value))return null;
 try{const url=new URL(value);return url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
export function localCardCheckoutHref(value:unknown):string|null{
 if(!value||typeof value!=='object')return null;
 const result=value as Record<string,unknown>;
 return result.provider==='local_simulator'&&typeof result.checkout_id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.checkout_id)?'/academy/course-checkout/'+result.checkout_id:null;
}
type IntakeArguments={p_id:string;p_request:string;p_name:string;p_terms:string;p_agree:boolean;p_price:number;p_class:string|null;p_answers:Record<string,string>};
export function cardCheckoutHref(value:unknown):string|null{
 const local=localCardCheckoutHref(value);if(local)return local;
 if(!value||typeof value!=='object')return null;
 const result=value as Record<string,unknown>;
 return result.provider==='stripe_connect'&&['test','live'].includes(String(result.mode))&&typeof result.checkout_id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.checkout_id)?'/academy/course-stripe-checkout/'+result.checkout_id:null;
}
export function publicIntakeSubmission(instructor:boolean,method:PublicPaymentMethod,args:IntakeArguments,cardMode?:'test'|'live'){
 if(instructor)return {name:'academy2_submit_public_intake_with_answers',args:{...args,p_instructor:true}};
 if(method==='card')return cardMode?{name:'academy2_submit_public_intake_stripe',args:{...args,p_mode:cardMode}}:{name:'academy2_submit_public_intake_card',args};
 return {name:'academy2_submit_public_intake_payment',args:{...args,p_instructor:false,p_payment_method:method}};
}
