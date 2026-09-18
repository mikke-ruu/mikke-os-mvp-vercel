import { getLinkPreview } from "@/lib/media-app/link-preview-server";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
const recent = new Map<string, { start: number; count: number }>();
export async function POST(request: Request) {
  try {
    if (!request.headers.get("origin") || new URL(request.headers.get("origin")!).host !== request.headers.get("host")) return new Response(null,{status:403});
    const token=request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1];
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if(!token||!url||!key)return new Response(null,{status:401});
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const {data,error}=await client.auth.getUser(token);
    if(error||!data.user||data.user.is_anonymous)return new Response(null,{status:401});
    const now=Date.now();
    for(const [id,value] of recent)if(now-value.start>60000)recent.delete(id);
    const rate=recent.get(data.user.id)??{start:now,count:0};
    if(rate.count>=30)return new Response(null,{status:429,headers:{"Retry-After":"60"}});
    rate.count++;recent.set(data.user.id,rate);
    if(!request.body)throw Error();
    const reader=request.body.getReader();const chunks:Uint8Array[]=[];let bytes=0;
    for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>4096){await reader.cancel();return new Response(null,{status:413});}chunks.push(value);}
    const raw=new TextDecoder().decode(Buffer.concat(chunks));
    const input=JSON.parse(raw);if(typeof input.url!=="string"||input.url.length>2048)throw Error();
    return Response.json(await getLinkPreview(input.url),{headers:{"Cache-Control":"no-store"}});
  } catch {return Response.json({message:"カード情報を取得できませんでした。表示名や画像は手動でも設定できます。"},{status:422,headers:{"Cache-Control":"no-store"}});}
}
