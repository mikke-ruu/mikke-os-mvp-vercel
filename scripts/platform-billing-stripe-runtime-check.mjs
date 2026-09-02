import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,nextResolve){
  if(specifier==='server-only')return{url:'data:text/javascript,export{}',shortCircuit:true};
  if(specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return nextResolve(`${specifier}.ts`,context);
  return nextResolve(specifier,context);
}});
const {createStripeProvider,readStripeRuntimeConfig,verifyStripeEvent}=await import('../lib/billing/platform/stripe.ts');
const now=new Date('2026-09-03T00:00:00.000Z'),timestamp=Math.floor(now.getTime()/1000);
const config=readStripeRuntimeConfig({
  PLATFORM_BILLING_STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',
  PLATFORM_BILLING_STRIPE_SUCCESS_URL:'https://app.mikke-os.com/billing/success',
  PLATFORM_BILLING_STRIPE_CANCEL_URL:'https://app.mikke-os.com/billing/cancel',
  PLATFORM_BILLING_STRIPE_PORTAL_RETURN_URL:'https://app.mikke-os.com/manager',
  PLATFORM_BILLING_STRIPE_PRICES_JSON:'{"academy_platform:small":"price_fixture"}',
});
let captured;const fakeFetch=async(url,init)=>{captured={url,init};return new Response(JSON.stringify(
  url.endsWith('/billing_portal/sessions')?{url:'https://billing.stripe.com/p/fixture'}:
  url.includes('/checkout/sessions/cs_')?{id:'cs_test_Fixture',url:'https://checkout.stripe.com/c/fixture',expires_at:timestamp+1800}:
  {id:'cs_test_Fixture',url:'https://checkout.stripe.com/c/fixture',expires_at:timestamp+1800}
),{status:200});};
const provider=createStripeProvider(config,fakeFetch),signal=new AbortController().signal;
assert.deepEqual(await provider.createCheckout({attemptId:'a0030000-0000-4000-8000-000000000001',productKey:'academy_platform',planKey:'small',idempotencyKey:'platform-checkout-a0030000-0000-4000-8000-000000000001'},signal),{id:'cs_test_Fixture',url:'https://checkout.stripe.com/c/fixture',expiresAt:'2026-09-03T00:30:00.000Z'});
assert.equal(captured.url,'https://api.stripe.com/v1/checkout/sessions');
assert.equal(captured.init.headers['Idempotency-Key'],'platform-checkout-a0030000-0000-4000-8000-000000000001');
const body=captured.init.body;assert.equal(body.get('mode'),'subscription');assert.equal(body.get('line_items[0][price]'),'price_fixture');
assert.equal(body.get('client_reference_id'),'a0030000-0000-4000-8000-000000000001');
assert.equal(body.has('customer_email'),false);assert.equal(body.has('trial_period_days'),false);
assert.equal(await provider.createPortal('cus_Fixture',signal),'https://billing.stripe.com/p/fixture');

function signed(value,overrideTime=timestamp){const text=JSON.stringify(value),raw=new TextEncoder().encode(text);const sig=createHmac('sha256',config.webhookSecret).update(`${overrideTime}.${text}`).digest('hex');return{raw,header:`t=${overrideTime},v1=${sig}`};}
const activation={id:'evt_Fixture',livemode:false,type:'checkout.session.completed',created:timestamp,data:{object:{
  id:'cs_test_Fixture',mode:'subscription',payment_status:'paid',client_reference_id:'a0030000-0000-4000-8000-000000000001',
  customer:'cus_Fixture',subscription:'sub_Fixture',amount_total:5000,currency:'jpy'
}}};
const signedActivation=signed(activation);
assert.deepEqual(verifyStripeEvent(signedActivation.raw,signedActivation.header,config,now),{
  kind:'activation',eventId:'evt_Fixture',eventHash:await crypto.subtle.digest('SHA-256',signedActivation.raw).then(v=>Buffer.from(v).toString('hex')),
  attemptId:'a0030000-0000-4000-8000-000000000001',sessionId:'cs_test_Fixture',customerId:'cus_Fixture',
  subscriptionId:'sub_Fixture',amountTotal:5000,currency:'jpy',paidAt:'2026-09-03T00:00:00.000Z'
});
assert.throws(()=>verifyStripeEvent(signedActivation.raw,'t=1788393600,v1='+('0'.repeat(64)),config,now),/INVALID_SIGNATURE/);
const staleActivation=signed(activation,timestamp-301);
assert.throws(()=>verifyStripeEvent(staleActivation.raw,staleActivation.header,config,now),/INVALID_SIGNATURE/);
for(const change of [{payment_status:'unpaid'},{amount_total:'5000'},{currency:'usd'},{mode:'payment'}]){
  const event=structuredClone(activation);Object.assign(event.data.object,change);const item=signed(event);assert.throws(()=>verifyStripeEvent(item.raw,item.header,config,now),/INVALID_EVENT/);
}
const invoice={id:'evt_Invoice',livemode:false,type:'invoice.paid',created:timestamp,data:{object:{subscription:'sub_Fixture',period_start:timestamp,period_end:timestamp+2678400}}};
const signedInvoice=signed(invoice);assert.equal(verifyStripeEvent(signedInvoice.raw,signedInvoice.header,config,now).kind,'invoice_paid');
assert.throws(()=>readStripeRuntimeConfig({...process.env,PLATFORM_BILLING_STRIPE_MODE:'live',STRIPE_SECRET_KEY:'sk_test_wrong'}),/BILLING_NOT_CONFIGURED/);

const migration=readFileSync(new URL('../supabase/migrations/20260902223651_platform_billing_subscription_runtime.sql',import.meta.url),'utf8');
for(const phrase of ['platform_billing_verified_subscription_activate','platform_billing_subscription_event_apply','platform_billing_status_get','platform_billing_portal_context','platform_billing_academy_new_paid_consume','platform_billing_academy_existing_paid_consume','invoice_paid','invoice_failed','subscription_state','next_anchored_month'])assert.ok(migration.includes(phrase),phrase);
assert.match(migration,/create or replace function public\.platform_billing_attempt_mark_ready[\s\S]*\^cs_\(test\|live\)_/);
const route=readFileSync(new URL('../app/api/billing/platform/webhook/stripe/route.ts',import.meta.url),'utf8');
assert.match(route,/request\.arrayBuffer\(\)/);assert.match(route,/stripe-signature/);assert.doesNotMatch(route,/console\.|rawBody|customer_email/);
const oldMigration=readFileSync(new URL('../supabase/migrations/20260902171944_platform_billing_verified_provider_events.sql',import.meta.url),'utf8');
assert.match(oldMigration,/\^evt_test_/);assert.match(oldMigration,/\^cs_test_/);
console.log('platform billing Stripe runtime contract: ok');
