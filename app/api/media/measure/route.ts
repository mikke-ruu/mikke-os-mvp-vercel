import {createClient} from '@supabase/supabase-js';
import {mediaMeasurementIdentity} from '@/lib/media-app/measurement-server';
export const runtime='nodejs';
const recent=new Map<string,{start:number;count:number}>();
const response=(status:number)=>new Response(null,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 try{
  const origin=request.headers.get('origin');if(!origin||new URL(origin).host!==request.headers.get('host'))return response(403);
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json'||!request.body)return response(400);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
  const platform=process.env.NETLIFY==='true'?'netlify':process.env.VERCEL==='1'?'vercel':process.env.NODE_ENV==='development'?'local':null;
  if(!url||!secret||!platform)return response(503);
  const identity=mediaMeasurementIdentity(request.headers,secret,platform,new Date().toISOString().slice(0,10));if(!identity)return response(429);
  const now=Date.now();for(const [id,value] of recent)if(now-value.start>=60000)recent.delete(id);
  if(recent.size>=2000&&!recent.has(identity.rateKey))return response(429);
  const rate=recent.get(identity.rateKey)??{start:now,count:0};if(rate.count>=30)return response(429);rate.count++;recent.set(identity.rateKey,rate);
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
  for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>512){await reader.cancel();return response(413);}chunks.push(value);}
  const input=JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
  if(!input||typeof input.site!=='string'||typeof input.article!=='string'||!/^[a-z0-9-]{1,80}$/.test(input.site)||!/^[a-z0-9-]{1,100}$/.test(input.article)||!['read','share'].includes(input.kind)||Object.keys(input).some(key=>!['site','article','kind'].includes(key)))return response(400);
  const client=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data,error}=await client.rpc('media_record_read',{p_site:input.site,p_article:input.article,p_visitor:identity.visitor,p_kind:input.kind,p_rate_key:identity.rateKey});
  return response(error?503:data?204:429);
 }catch{return response(400);}
}
