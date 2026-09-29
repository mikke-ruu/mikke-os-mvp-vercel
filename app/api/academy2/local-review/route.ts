import {createClient} from '@supabase/supabase-js';
export const runtime='nodejs';
const allowed=new Set(['ac209988-0000-4000-8000-000000000011']);
async function serve(request:Request,write:boolean){
 let source:URL,host:URL;try{source=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL??'');host=new URL(request.url);}catch{return new Response(null,{status:404});}
 if(process.env.ACADEMY2_LOCAL_BUILT_REVIEW!=='1'||!['127.0.0.1','localhost'].includes(source.hostname)||source.port!=='57680'||!['127.0.0.1','localhost'].includes(host.hostname))return new Response(null,{status:404});
 const input=write?await request.json().catch(()=>null):{headquartersId:host.searchParams.get('headquartersId')};
 if(!input||!allowed.has(input.headquartersId)||Object.keys(input).some(k=>!['headquartersId','card','community'].includes(k))||['card','community'].some(k=>k in input&&typeof input[k]!=='boolean'))return Response.json({error:'対象の確認用本部を選んでください。'},{status:404});
 const authorization=request.headers.get('authorization');if(!authorization?.startsWith('Bearer '))return Response.json({error:'ログインしてください。'},{status:401});
 const client=createClient(source.href,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??'',{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.rpc(write?'academy2_local_review_set':'academy2_local_review_state',{p_hq:input.headquartersId,...(write?{p_card:input.card??null,p_community:input.community??null}:{})});
 if(error)return Response.json({error:'ローカル確認状態を処理できませんでした。'},{status:error.code==='42501'?403:400});
 return Response.json(data,{headers:{'Cache-Control':'no-store'}});
}
export async function GET(request:Request){return serve(request,false);}
export async function POST(request:Request){return serve(request,true);}
