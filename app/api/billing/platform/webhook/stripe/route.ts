import { createClient } from '@supabase/supabase-js';
import { readStripeRuntimeConfig, verifyStripeEvent } from '@/lib/billing/platform/stripe';
import { applyVerifiedStripeEvent } from '@/lib/billing/platform/webhook-runtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

const headers = { 'Cache-Control':'private, no-store, max-age=0', 'X-Content-Type-Options':'nosniff' };
const response = (status:number, body:Record<string,unknown>) => Response.json(body,{status,headers});

function adminClient() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || new URL(url).protocol!=='https:') throw new Error('BILLING_NOT_CONFIGURED');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}

export async function POST(request:Request) {
  try {
    const length=request.headers.get('content-length');
    if (length!==null && (!/^\d+$/.test(length) || Number(length)>262144)) return response(413,{received:false});
    const raw=new Uint8Array(await request.arrayBuffer());
    const config=readStripeRuntimeConfig();
    let event;
    try { event=verifyStripeEvent(raw,request.headers.get('stripe-signature'),config); }
    catch (error) {
      if (error instanceof Error && error.message==='UNSUPPORTED_EVENT') return response(200,{received:true,ignored:true});
      return response(400,{received:false});
    }
    const client=adminClient();
    await applyVerifiedStripeEvent(event, async (name,args) => {
      const { data,error }=await client.rpc(name as never,args as never);
      return { data:data as unknown,error };
    });
    return response(200,{received:true});
  } catch { return response(503,{received:false}); }
}
