// Server-side sandbox adapter. No environment lookup and no live fallback.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { checkoutUuid } from './opening-checkout-policy.mjs';

const fail = code => { throw new Error(code); };
const check = (condition, code) => { if (!condition) fail(code); };
const object = value => { check(value && typeof value === 'object' && !Array.isArray(value), 'STRIPE_RESPONSE_INVALID'); return value; };
const id = (value, prefix) => typeof value === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9]+$`).test(value);
const allowedEvents = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired']);

/** order must come from an authenticated, persisted invoice/checkout, never JSON input. */
function validateOrder(order) {
  check(order && ['checkoutId','invoiceId','applicationId','headquartersId','actorId'].every(k => checkoutUuid(order[k]))
    && id(order.accountId,'acct') && Number.isSafeInteger(order.amountMinor) && order.amountMinor > 0
    && order.currency === 'jpy' && order.sandboxFixture === true, 'STRIPE_ORDER_INVALID');
}
function metadata(order) { return { academy2_checkout_id:order.checkoutId, academy2_invoice_id:order.invoiceId, academy2_headquarters_id:order.headquartersId, academy2_actor_id:order.actorId }; }
function verifyMetadata(raw, order) {
  const saved = object(raw);
  check(Object.entries(metadata(order)).every(([key,value]) => saved[key] === value), 'STRIPE_ORDER_MISMATCH');
}

export function createOpeningStripeTestProvider(config, fetcher = fetch) {
  // A production Next build may run in this dedicated loopback sandbox. No deployed origin is accepted.
  check(config?.mode === 'stripe_test_direct' && config.sandboxEnabled === true
    && /^sk_test_[A-Za-z0-9]+$/.test(config.secretKey ?? '')
    && /^\d{4}-\d{2}-\d{2}(\.[a-z]+)?$/.test(config.apiVersion ?? '')
    && config.origin === 'http://127.0.0.1:57670'
    && config.supabaseOrigin === 'http://127.0.0.1:57680', 'STRIPE_TEST_CONFIG_REQUIRED');
  const settings = Object.freeze({ ...config });
  async function request(path, accountId, form, idem) {
    const response = await fetcher(`https://api.stripe.com/v1/${path}`, {
      method: form ? 'POST' : 'GET', body: form, cache:'no-store', redirect:'error', signal:AbortSignal.timeout(20000),
      headers: { Authorization:`Bearer ${settings.secretKey}`, 'Stripe-Version':settings.apiVersion,
        ...(accountId ? { 'Stripe-Account':accountId } : {}), ...(idem ? { 'Idempotency-Key':idem } : {}),
        ...(form ? { 'Content-Type':'application/x-www-form-urlencoded' } : {}) },
    });
    check(response.ok && response.body, 'STRIPE_UNAVAILABLE');
    const reader=response.body.getReader(); const chunks=[]; let size=0;
    try { for (;;) { const part=await reader.read(); if(part.done) break; size+=part.value.byteLength;
      if(size>262144) { await reader.cancel(); fail('STRIPE_RESPONSE_TOO_LARGE'); } chunks.push(part.value); }
    } finally { reader.releaseLock(); }
    return object(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  }
  async function account(order) {
    const raw=await request(`accounts/${order.accountId}`);
    check(raw.id===order.accountId && raw.object==='account' && raw.charges_enabled===true
      && raw.payouts_enabled===true && raw.details_submitted===true && raw.capabilities?.card_payments==='active'
      && raw.requirements?.disabled_reason===null, 'STRIPE_ACCOUNT_NOT_READY');
    return {accountId:order.accountId,chargesEnabled:true,payoutsEnabled:true};
  }
  function session(raw, order, sessionId) {
    check(raw.object==='checkout.session' && id(raw.id,'cs_test') && (!sessionId || raw.id===sessionId)
      && raw.livemode===false && raw.mode==='payment' && raw.amount_total===order.amountMinor
      && raw.currency===order.currency && raw.client_reference_id===order.checkoutId, 'STRIPE_SESSION_MISMATCH');
    verifyMetadata(raw.metadata,order);
  }
  return {
    async readInstructorAccount(accountId, userId) {
      check(id(accountId,'acct') && checkoutUuid(userId),'STRIPE_INSTRUCTOR_BINDING_INVALID');
      const raw=await request(`accounts/${accountId}`);
      check(raw.id===accountId && raw.object==='account'
        && raw.metadata?.academy2_instructor_user_id===userId,'STRIPE_INSTRUCTOR_BINDING_MISMATCH');
      return {accountId,userId,mode:'test',chargesEnabled:raw.charges_enabled===true && raw.capabilities?.card_payments==='active' && raw.requirements?.disabled_reason===null,
        payoutsEnabled:raw.payouts_enabled===true,detailsSubmitted:raw.details_submitted===true};
    },
    async resumeCheckout(order, sessionId, actorId) {
      validateOrder(order);check(actorId===order.actorId,'STRIPE_ACTOR_MISMATCH');check(id(sessionId,'cs_test'),'STRIPE_SESSION_INVALID');
      const raw=await request(`checkout/sessions/${sessionId}`,order.accountId);session(raw,order,sessionId);
      if(raw.status==='complete') return {sessionId,checkoutUrl:`${settings.origin}/academy/opening-license-checkout/${order.checkoutId}?provider=stripe_test_direct`,accountId:order.accountId};
      check(raw.status==='open' && typeof raw.url==='string','STRIPE_SESSION_EXPIRED');const url=new URL(raw.url);
      check(url.protocol==='https:' && url.hostname==='checkout.stripe.com' && !url.port && !url.username && !url.password,'STRIPE_CHECKOUT_URL_INVALID');
      return {sessionId,checkoutUrl:raw.url,accountId:order.accountId};
    },
    async createCheckout(order, actorId) {
      validateOrder(order); check(actorId===order.actorId,'STRIPE_ACTOR_MISMATCH'); await account(order);
      const returnPath=`${settings.origin}/academy/opening-license-checkout/${order.checkoutId}?provider=stripe_test_direct`;
      const form=new URLSearchParams({mode:'payment','payment_method_types[0]':'card',client_reference_id:order.checkoutId,
        success_url:returnPath,cancel_url:returnPath,'line_items[0][quantity]':'1',
        'line_items[0][price_data][currency]':order.currency,'line_items[0][price_data][unit_amount]':String(order.amountMinor),
        'line_items[0][price_data][product_data][name]':'開講ライセンス（テスト）'});
      for (const [key,value] of Object.entries(metadata(order))) { form.set(`metadata[${key}]`,value); form.set(`payment_intent_data[metadata][${key}]`,value); }
      // No commercial fee default. Test request does not set application_fee_amount or transfer_data.
      const raw=await request('checkout/sessions',order.accountId,form,`academy2-opening-test:${order.checkoutId}`);
      session(raw,order);
      check(typeof raw.url==='string','STRIPE_CHECKOUT_URL_INVALID'); const url=new URL(raw.url);
      check(url.protocol==='https:' && url.hostname==='checkout.stripe.com' && !url.port && !url.username && !url.password,'STRIPE_CHECKOUT_URL_INVALID');
      return {sessionId:raw.id,checkoutUrl:raw.url,accountId:order.accountId};
    },
    async readPayment(order, sessionId) {
      validateOrder(order); check(id(sessionId,'cs_test'),'STRIPE_SESSION_INVALID');
      const raw=await request(`checkout/sessions/${sessionId}`,order.accountId); session(raw,order,sessionId);
      if(raw.payment_status!=='paid') return {status:'pending',sessionId};
      check(raw.status==='complete' && id(raw.payment_intent,'pi'),'STRIPE_SESSION_UNSETTLED');
      const intent=await request(`payment_intents/${raw.payment_intent}`,order.accountId);
      check(intent.id===raw.payment_intent && intent.object==='payment_intent' && intent.livemode===false
        && intent.amount===order.amountMinor && intent.amount_received===order.amountMinor && intent.currency===order.currency
        && intent.status==='succeeded' && !intent.transfer_data && !intent.on_behalf_of && id(intent.latest_charge,'ch'),'STRIPE_PAYMENT_MISMATCH');
      verifyMetadata(intent.metadata,order);
      const charge=await request(`charges/${intent.latest_charge}`,order.accountId);
      check(charge.id===intent.latest_charge && charge.object==='charge' && charge.livemode===false && charge.payment_intent===intent.id
        && charge.amount===order.amountMinor && charge.amount_captured===order.amountMinor && charge.currency===order.currency
        && charge.paid===true && charge.captured===true && charge.amount_refunded===0 && charge.disputed===false
        && !charge.transfer_data && !charge.on_behalf_of,'STRIPE_CHARGE_UNSETTLED');
      return {status:'paid',sessionId,paymentIntentId:intent.id,chargeId:charge.id,accountId:order.accountId,
        invoiceId:order.invoiceId,checkoutId:order.checkoutId,amountMinor:order.amountMinor,currency:order.currency,
        platformFeeAmount:null,processorFeeAmount:null};
    },
  };
}

/** The caller must read the bounded raw body before parsing JSON. */
export function verifyOpeningStripeTestEvent(raw, signature, secret, nowSeconds = Math.floor(Date.now()/1000)) {
  check(Buffer.isBuffer(raw) && raw.length<=262144 && typeof signature==='string' && signature.length<=8192
    && /^whsec_[A-Za-z0-9]+$/.test(secret ?? ''),'STRIPE_SIGNATURE_INVALID');
  const fields=signature.split(',').map(part=>part.trim().split('='));
  const timestamps=fields.filter(([key])=>key==='t');
  check(timestamps.length===1 && /^\d+$/.test(timestamps[0][1]??''),'STRIPE_SIGNATURE_INVALID');
  const timestamp=Number(timestamps[0][1]);
  check(Number.isSafeInteger(timestamp) && Math.abs(nowSeconds-timestamp)<=300,'STRIPE_SIGNATURE_EXPIRED');
  const expected=createHmac('sha256',secret).update(`${timestamp}.`).update(raw).digest();
  check(fields.some(([key,value])=>key==='v1' && /^[a-f0-9]{64}$/.test(value??'') && timingSafeEqual(expected,Buffer.from(value,'hex'))),'STRIPE_SIGNATURE_INVALID');
  const event=object(JSON.parse(raw.toString('utf8')));
  check(event.object==='event' && id(event.id,'evt') && event.livemode===false && id(event.account,'acct'),'STRIPE_EVENT_INVALID');
  if(!allowedEvents.has(event.type)) return null;
  const payload=object(event.data?.object);
  check(payload.object==='checkout.session' && payload.livemode===false && id(payload.id,'cs_test'),'STRIPE_EVENT_INVALID');
  // Metadata is deliberately excluded. Locate a previously registered session/account pair.
  return {eventId:event.id,eventType:event.type,accountId:event.account,sessionId:payload.id};
}

/** store.find is read-only; settle must lock invoice and deduplicate event + session atomically. */
export async function reconcileOpeningStripeTestEvent(event, provider, store) {
  if(!event) return {status:'ignored'};
  const registered=await store.find(event.accountId,event.sessionId);
  check(registered && registered.order.accountId===event.accountId && registered.sessionId===event.sessionId,'STRIPE_EVENT_UNREGISTERED');
  const payment=await provider.readPayment(registered.order,registered.sessionId);
  if(payment.status!=='paid') return {status:'pending'};
  // Re-read even for duplicate/old notifications; never trust event-created order or event status.
  return store.settle(event,payment);
}
