import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';

type Environment=Record<string,string|undefined>;
export type GuestServerConfig={origin:string;mode:'capture'|'provider';secureCookie:boolean};

/** Server-side only. Enabling a deployment and enabling real delivery are separate approvals. */
export function guestServerConfig(requestUrl:string,env:Environment):GuestServerConfig|null{
 const url=new URL(requestUrl);
 if(!env.SUPABASE_SERVICE_ROLE_KEY)return null;
 if(env.ACADEMY_GUEST_LOCAL==='1'&&['http://127.0.0.1:57982','http://127.0.0.1:57983'].includes(env.NEXT_PUBLIC_SUPABASE_URL??'')&&env.ACADEMY_LOCAL_CAPTURE_KEY){
  const expected=env.ACADEMY_GUEST_LOCAL_ORIGIN;
  // Next's local request URL may use localhost even when the browser uses
  // 127.0.0.1. Keep the browser Origin exact; only normalize the server alias.
  if(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)){
   if(expected){
    try{const browser=new URL(expected);if(browser.protocol==='http:'&&['127.0.0.1','localhost'].includes(browser.hostname)&&browser.port===url.port)return {origin:browser.origin,mode:'capture',secureCookie:false};}catch{return null;}
   }else if(url.port==='57870')return {origin:url.origin,mode:'capture',secureCookie:false};
  }
 }
 if(env.ACADEMY_GUEST_ENABLED!=='true'||env.ACADEMY_GUEST_EMAIL_ENABLED!=='true'||env.VERCEL!=='1'||
  url.origin!=='https://app.mikke-os.com'||!env.ACADEMY_GUEST_TARGET_SUPABASE_URL||
  env.NEXT_PUBLIC_SUPABASE_URL!==env.ACADEMY_GUEST_TARGET_SUPABASE_URL||
  !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(env.ACADEMY_GUEST_TARGET_SUPABASE_URL)||
  !env.RESEND_API_KEY||!env.ACADEMY_GUEST_FROM||/[\r\n]/.test(env.ACADEMY_GUEST_FROM)||
  !env.ACADEMY_GUEST_FROM.includes('@')||(env.ACADEMY_GUEST_RATE_SECRET?.length??0)<32)return null;
 return {origin:url.origin,mode:'provider',secureCookie:true};
}

/** Trust Vercel's own overwritten header only on the explicitly enabled Vercel runtime. */
export function guestRateKey(request:Request,config:GuestServerConfig,env:Environment,session:string,now=new Date()):string|null{
 if(config.mode==='capture')return createHmac('sha256',env.ACADEMY_LOCAL_CAPTURE_KEY!).update(session).digest('hex');
 if(env.VERCEL!=='1'||!env.ACADEMY_GUEST_RATE_SECRET)return null;
 const raw=request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
 if(!raw||raw.length>100||!isIP(raw))return null;
 const normalized=isIP(raw)===6?new URL('http://['+raw+']').hostname:raw;
 // Store neither the raw IP nor a permanent cross-day identifier.
 return createHmac('sha256',env.ACADEMY_GUEST_RATE_SECRET).update(now.toISOString().slice(0,10)+':'+normalized).digest('hex');
}
