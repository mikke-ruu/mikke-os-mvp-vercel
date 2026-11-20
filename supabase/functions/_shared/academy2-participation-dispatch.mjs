import {deliverParticipationMail} from './academy2-participation-mail.mjs';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const safePath=value=>typeof value==='string'&&/^\/academy\/(?:site\/[a-z0-9_-]+|(?:page|o)\/[a-f0-9-]{36})$/.test(value)?value:null;
export function renderParticipationMessage(mail){
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 return {to:mail.to,subject:String(mail.subject).replace(/[\r\n]+/g,' ').slice(0,240),text:mail.body,html:'<div style="font-family:sans-serif;line-height:1.8">'+escape(mail.body).replace(/\n/g,'<br>')+'</div>'};
}

/** Queue enumeration is service-only; each claim rechecks the saved payment. */
export async function dispatchParticipationJobs({client,enabled,deliver,origin}){
 const result={processed:0,sent:0,needsReview:0};
 if(!enabled)return {...result,disabled:true};
 const root=new URL(origin);
 if(root.origin!=='https://app.mikke-os.com'&&!(root.protocol==='http:'&&['127.0.0.1','localhost'].includes(root.hostname)))throw Error('untrusted_mail_origin');
 const list=await client.rpc('academy2_pending_participation_mail',{p_limit:3});
 if(list.error||!Array.isArray(list.data)||list.data.length>3||list.data.some(j=>!uuid.test(j.id)||!['member','guest'].includes(j.kind)))throw Error('participation_queue_unavailable');
 for(const job of list.data){
  result.processed++;
  let providerId=null,deliveryToken=null;
  const scopedClient={async rpc(name,args){
   if(name==='academy2_claim_participation_mail'){
    const response=await client.rpc(job.kind==='guest'?'academy2_claim_guest_participation_mail':name,args);
    if(response.data?.outcome==='claimed')deliveryToken=response.data.token;
    return response;
   }
   if(name==='academy2_finish_participation_mail')return client.rpc(job.kind==='guest'?'academy2_finish_guest_participation_mail':'academy2_finish_participation_mail_v2',{...args,p_provider:providerId});
   throw Error('unexpected_participation_operation');
  }};
  try{
   const state=await deliverParticipationMail(scopedClient,job.id,async mail=>{
    const stored=await client.rpc('academy2_store_participation_message',{p_kind:job.kind,p_job:job.id,p_token:deliveryToken,p_message:renderParticipationMessage(mail)});
    if(stored.error)throw Error('participation_message_unavailable');
    const response=await deliver(mail);
    if(response?.status==='accepted'&&typeof response.messageId==='string')providerId=response.messageId;
    return response;
   },async payload=>({home:safePath(payload.homePath)?root.origin+payload.homePath:undefined,plan:safePath(payload.planPath)?root.origin+payload.planPath:undefined,
    study:job.kind==='guest'&&payload.materialsEnabled===true&&uuid.test(payload.guestApplicationId??'')&&typeof payload.guestAccessPath==='string'&&new RegExp('^/academy/guest-materials[?]application='+payload.guestApplicationId+'#receive=[a-f0-9]{64}$').test(payload.guestAccessPath)?root.origin+payload.guestAccessPath:undefined}));
   if(state==='sent')result.sent++;
   else if(['failed','unknown'].includes(state))result.needsReview++;
  }catch{result.needsReview++;}
 }
 return result;
}

/** Injected environment and fetch keep this testable without a real provider. */
export function participationTransport(env,fetcher=fetch){
 const local=env.ACADEMY_LOCAL_CAPTURE==='true'&&['http://127.0.0.1:57982','http://localhost:57982','http://host.docker.internal:57982'].includes((env.SUPABASE_URL??'').replace(/\/$/,''))&&!!env.ACADEMY_LOCAL_CAPTURE_KEY;
 const enabled=local||(env.ACADEMY_PARTICIPATION_MAIL_ENABLED==='true'&&!!env.RESEND_API_KEY&&!!env.ACADEMY_PARTICIPATION_FROM&&!/[\r\n]/.test(env.ACADEMY_PARTICIPATION_FROM));
 const origin=local?(env.ACADEMY_LOCAL_TEST_ORIGIN||'http://127.0.0.1:57870'):'https://app.mikke-os.com';
 return {enabled,origin,async deliver(mail){
  if(!enabled)return {status:'rejected'};
  if(local&&!mail.to.endsWith('.invalid'))return {status:'rejected'};
  const message=renderParticipationMessage(mail);
  try{
   const response=await fetcher(local?'http://host.docker.internal:57887/capture':'https://api.resend.com/emails',{method:'POST',headers:local?{'Content-Type':'application/json',Authorization:'Bearer '+env.ACADEMY_LOCAL_CAPTURE_KEY}:{'Content-Type':'application/json',Authorization:'Bearer '+env.RESEND_API_KEY,'Idempotency-Key':mail.idempotencyKey},body:JSON.stringify(local?{...message,idempotencyKey:mail.idempotencyKey}:{from:env.ACADEMY_PARTICIPATION_FROM,...message}),signal:AbortSignal.timeout(15000)});
   if(!response.ok)return [400,401,403,422,429].includes(response.status)?{status:'rejected'}:{status:'unknown'};
   const value=await response.json();
   return typeof value?.id==='string'&&value.id.length>0&&value.id.length<=200?{status:'accepted',messageId:value.id}:{status:'unknown'};
  }catch{return {status:'unknown'};}
 }};
}
