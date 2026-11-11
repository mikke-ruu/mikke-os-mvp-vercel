import {createHash,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {guestServerConfig,guestRateKey} from '@/lib/academy2/guest-server-config';
import {deliverGuestMail,type GuestMail} from '@/lib/academy2/guest-mail-delivery';
import {receiptV2} from '@/lib/academy2/receipt-v2.mjs';
import {guestMaterialToken} from '@/lib/academy2/guest-material-token';
import {appendGuestMaterialAccess} from '@/lib/academy2/guest-material-link.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const cookieName='academy_guest_receipt';
const reply=(value:unknown,status=200,headers:Record<string,string>={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store','Vary':'Cookie',...headers}});
function cookie(request:Request){return request.headers.get('cookie')?.match(/(?:^|;\s*)academy_guest_receipt=([a-f0-9]{64})(?:;|$)/)?.[1]??null;}
function admin(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});}
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function GET(request:Request){
 const config=guestServerConfig(request.url,process.env);
 if(!config)return reply({enabled:false});
 const token=cookie(request)??randomBytes(32).toString('hex');
 return reply({enabled:true},200,{'Set-Cookie':`${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/api/academy2/guest-application; Max-Age=1800${config.secureCookie?'; Secure':''}`});
}
export async function POST(request:Request){
 const config=guestServerConfig(request.url,process.env);
 if(!config)return reply({error:'受付の接続を確認できません。'},503);
 if(request.headers.get('origin')!==config.origin||!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'受付画面からお申し込みください。'},403);
 const token=cookie(request);if(!token)return reply({error:'受付画面を再読み込みしてください。'},409);
 const session=createHash('sha256').update(token).digest('hex');
 const rateKey=guestRateKey(request,config,process.env,session);
 if(!rateKey)return reply({error:'受付の接続を確認できません。'},503);
 try{
  const db=admin();
  const budget=await db.rpc('academy2_guest_intake_budget',{p_key:rateKey});
  if(budget.error)return reply({error:budget.error.code==='PT429'?'続けてのお申し込みは、少し時間をおいてお試しください。':'受付状況を確認できません。'},budget.error.code==='PT429'?429:503);
  const reader=request.body?.getReader();if(!reader)return reply({error:'入力内容を確認してください。'},400);
  const chunks:Uint8Array[]=[];let total=0;
  for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>40000){await reader.cancel();return reply({error:'入力内容が長すぎます。'},413);}chunks.push(value);}
  let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return reply({error:'入力内容を確認してください。'},400);}
  if(!input||Array.isArray(input)||typeof input.name!=='string'||!input.name.trim()||typeof input.email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)||!Number.isSafeInteger(input.price)||input.price<0)return reply({error:'お名前・メールアドレスなどの入力内容を確認してください。'},400);
  const {data,error}=await db.rpc('academy2_submit_guest',{p_session:session,p_input:input});
  if(error)return reply({error:error.code==='PT429'?'続けてのお申し込みは、少し時間をおいてお試しください。':error.message.includes('full')?'この日程は定員に達しました。別の日程をお選びください。':error.code==='PT409'?'料金・日程・規約などが更新されました。内容を再確認してください。':'お申し込みを受け付けられませんでした。入力内容と開催の受付状況をご確認ください。'},error.code==='PT429'?429:409);
  const stored=await db.rpc('academy2_guest_receipt',{p_id:data.id,p_session:session});
  const record=stored.data;let mailState=record?.state??'unknown';
  let accessToken:string|undefined;let materialsEnabled=false;
  if(!stored.error&&record){
   try{
    const capability=guestMaterialToken(data.id,session,(config.mode==='capture'?process.env.ACADEMY_LOCAL_CAPTURE_KEY:process.env.ACADEMY_GUEST_RATE_SECRET)??'');
    const prepared=await db.rpc('academy2_prepare_guest_material_link',{p_application_id:data.id,p_session:session,p_receipt_token:capability});
    if(prepared.error)throw Error('guest_material_preparation_failed');
    materialsEnabled=prepared.data?.enabled===true;
    if(materialsEnabled&&prepared.data?.prepared!==true)throw Error('guest_material_token_conflict');
    if(materialsEnabled)accessToken=capability;
   }catch{mailState='unknown';}
  }
  if(!stored.error&&record&&mailState==='queued'){
   try{
    const s=record.snapshot;
    // This projection is intentionally executable only by public readers.
    // Do not expand its grants merely because the intake uses a service client.
    const publicReader=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
    const frame=await publicReader.rpc('academy2_public_site_frame',{p_headquarters_id:data.headquarters_id});
    if(frame.error)throw Error('mail_frame_unavailable');
    const title=s.intake.offering.title;
    const contact=s.seller?.contact_email||frame.data?.contact_email||'';
    const headquartersName=frame.data?.name||s.seller?.legal_name||'本部';
    const payload={name:record.name,title,price:record.price,method:record.method,bank_note:s.bankNote??'',payment_deadline:s.seller?.payment_deadline??'',external_payment_url:s.intake.offering.external_payment_url,headquartersName,contactEmail:contact,homePath:frame.data?.handle?'/academy/site/'+frame.data.handle:undefined,planPath:'/academy/o/'+input.offeringId,event:s.event,studyStyle:s.intake.formConfiguration?.study_style};
    let message:GuestMail;
    if(record.method==='onsite'){
     const when=s.event?.startsAt?new Date(s.event.startsAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',dateStyle:'long',timeStyle:'short'}):'日程は担当者からご案内します。';
     const text=[`${record.name} 様`,`このたびは「${title}」にお申し込みいただき、ありがとうございます。\nお申し込みを受け付けました。`,`開催日時：${when}`,`受講料：${Number(record.price).toLocaleString('ja-JP')}円（税込）\n当日のお支払い方法は担当者からご案内します。`,`講座のご案内：${config.origin}/academy/o/${input.offeringId}`,'このメールは自動送信です。返信ではお問い合わせを受け付けていません。',`内容にお間違いがある場合やご不明な点は、${headquartersName}へご連絡ください。\n${contact}`].join('\n\n');
     message={to:record.to,subject:`【Academy】お申し込みを受け付けました｜${title}`,text,html:esc(text).replace(/\n/g,'<br>')};
    }else message={to:record.to,...receiptV2(payload,config.origin)};
    message=appendGuestMaterialAccess(message,data.id,materialsEnabled,config.origin,accessToken);
    message.subject=message.subject.replace(/[\r\n]+/g,' ').slice(0,240);
    const claim=await db.rpc('academy2_claim_guest_receipt',{p_id:data.id,p_session:session,p_message:message});
    if(claim.error)throw Error('mail_claim_unavailable');
    mailState=claim.data?.state??'unknown';
    if(claim.data?.claimed){
     const outcome=await deliverGuestMail(claim.data.message,data.id,{mode:config.mode,captureKey:process.env.ACADEMY_LOCAL_CAPTURE_KEY,capturePort:process.env.ACADEMY_LOCAL_CAPTURE_PORT==='57888'||process.env.NEXT_PUBLIC_SUPABASE_URL==='http://127.0.0.1:57983'?57888:57887,apiKey:process.env.RESEND_API_KEY,from:process.env.ACADEMY_GUEST_FROM});
     const finish=await db.rpc('academy2_finish_guest_receipt',{p_id:data.id,p_session:session,p_state:outcome.state,p_provider:outcome.state==='sent'?outcome.providerId:null});
     mailState=finish.error?'unknown':finish.data?.state??'unknown';
    }
   }catch{mailState='unknown';}
  }
  return reply({...data,material_access_token:accessToken,mail_status:mailState==='sent'?'sent':'needs_review',bank_note:record?.method==='bank'?record?.snapshot?.bankNote:null});
 }catch{return reply({error:'受付結果を確認できませんでした。入力内容を残して、もう一度お試しください。'},503);}
}
