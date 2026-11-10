import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import {invitationAction} from '../_shared/mikke-invitations/core.mjs';
import {academyAdapter,teamWorksAdapter} from './adapters.ts';
const origins=new Set(['https://app.mikke-os.com','http://127.0.0.1:57681','http://localhost:57681']);
const localCapture=Deno.env.get('ACADEMY_LOCAL_CAPTURE')==='true'&&Deno.env.get('SUPABASE_URL')==='http://127.0.0.1:57982'&&!!Deno.env.get('ACADEMY_LOCAL_CAPTURE_KEY');
if(localCapture&&Deno.env.get('ACADEMY_LOCAL_TEST_ORIGIN')==='http://127.0.0.1:57871')origins.add('http://127.0.0.1:57871');
Deno.serve(async(request:Request)=>{
 const origin=request.headers.get('Origin')??'';const headers={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://app.mikke-os.com','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Vary':'Origin','Content-Type':'application/json','Cache-Control':'no-store'};
 if(origin&&!origins.has(origin))return new Response(JSON.stringify({error:'この接続元は利用できません。'}),{status:403,headers});
 if(request.method==='OPTIONS')return new Response(null,{headers});
 if(request.method!=='POST')return new Response(JSON.stringify({error:'利用できない操作です。'}),{status:405,headers});
 try{
  if(Number(request.headers.get('Content-Length')??0)>8192)throw new Error('request too large');
  const authorization=request.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return new Response(JSON.stringify({error:'ログインが必要です。'}),{status:401,headers});
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const caller=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await caller.auth.getUser();if(error||!user)return new Response(JSON.stringify({error:'ログイン状態を確認してください。'}),{status:401,headers});
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const raw=await request.text();if(raw.length>8192)throw new Error('request too large');const body=JSON.parse(raw);
  const adapters={academy:academyAdapter(caller),'team-works':teamWorksAdapter(admin,caller)};
  if(!Object.hasOwn(adapters,body.app))throw new Error('unsupported app');
  const ledger={
   async read(key:string){const {data,error}=await admin.from('mikke_invitation_mail_delivery').select('status').eq('delivery_key',key).maybeSingle();if(error)throw new Error('delivery read failed');return data;},
   async claim(value:any){const {error}=await admin.from('mikke_invitation_mail_delivery').insert({delivery_key:value.key,app_key:value.app,invitation_id:value.id,fingerprint:value.fingerprint});if(error?.code==='23505')return false;if(error)throw new Error('delivery claim failed');return true;},
   async mark(key:string,status:string,providerId?:string){const {data,error}=await admin.from('mikke_invitation_mail_delivery').update({status,...(providerId?{provider_id:providerId,sent_at:new Date().toISOString()}:{})}).eq('delivery_key',key).select('delivery_key').single();if(error||!data)throw new Error('delivery recording failed');}
  };
  const result=await invitationAction({app:body.app,id:body.id,action:body.action,fingerprint:body.fingerprint,user,adapter:adapters[body.app as keyof typeof adapters],ledger,enabled:localCapture||Deno.env.get('MIKKE_INVITATION_EMAIL_ENABLED')==='true'&&!!Deno.env.get('RESEND_API_KEY')&&!!Deno.env.get('MIKKE_INVITATION_FROM'),deliver:async(mail:any)=>{
   if(localCapture){
    if(!/^[^\s@]+@[^\s@]+\.invalid$/i.test(mail.to))throw new Error('local fixture recipient required');
    const response=await fetch('http://host.docker.internal:57887/capture',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+Deno.env.get('ACADEMY_LOCAL_CAPTURE_KEY')},body:JSON.stringify(mail),signal:AbortSignal.timeout(10000)});
    const result=await response.json();if(!response.ok||!result.id)throw new Error('local capture failed');return result;
   }
   const apiKey=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('MIKKE_INVITATION_FROM');if(!apiKey||!from)throw new Error('sender not configured');
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':mail.idempotencyKey},body:JSON.stringify({from,to:mail.to,subject:mail.subject,text:mail.text,html:mail.html}),signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new Error('provider failed');return await response.json();
  }});
  return new Response(JSON.stringify(result),{headers});
 }catch{
  // No raw provider/DB/auth messages, recipient details, SQL, or tokens enter responses or logs.
  return new Response(JSON.stringify({error:'招待の処理結果を確認できませんでした。再送せず、状態を確認してください。'}),{status:400,headers});
 }
});
