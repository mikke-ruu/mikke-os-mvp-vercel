import { createClient } from '@supabase/supabase-js';
import { readStripeRuntimeConfig, verifyStripeEvent } from '@/lib/billing/platform/stripe';

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
    const call=event.kind==='activation'
      ? client.rpc('platform_billing_verified_subscription_activate',{
          p_attempt_id:event.attemptId,p_provider_event_id:event.eventId,p_provider_event_hash:event.eventHash,
          p_provider_session_id:event.sessionId,p_provider_customer_id:event.customerId,
          p_provider_subscription_id:event.subscriptionId,p_amount_total:event.amountTotal,
          p_currency:event.currency,p_paid_at:event.paidAt,
        })
      : client.rpc('platform_billing_subscription_event_apply',{
          p_provider_subscription_id:event.subscriptionId,p_provider_event_id:event.eventId,
          p_provider_event_hash:event.eventHash,p_event_kind:event.kind,p_projected_status:event.status,
          p_period_start:event.periodStart,p_period_end:event.periodEnd,
          p_cancel_at_period_end:event.kind==='subscription_state'?event.cancelAtPeriodEnd:null,
          p_occurred_at:event.occurredAt,
        });
    const { error }=await call;
    if (error) return response(500,{received:false});
    return response(200,{received:true});
  } catch { return response(503,{received:false}); }
}
