import 'server-only';
import { priceUnits, verifyVariablePrice } from './price-contract';
import { createHash } from 'node:crypto';
import { createFirstPublicationStripe, demand, object, nextPaidMonth } from './stripe-runtime';
import type { SetupAttempt, JsonObject } from './stripe-runtime';

export type BillingJob = {
  event_key: string; lease_token: string; kind: 'synchronize_trial'|'cancel_conversion'|'start_paid';
  trial_ends_at: string; amount_yen: number; plan_key: string; proof: SetupAttempt;
};
export type WorkerStore = {
  dispatchCheck(job: BillingJob): Promise<boolean>;
  checkpoint(job: BillingJob, step: string, providerId?: string): Promise<{ operation_key: string; started_at: string; provider_id: string | null; blocked?: boolean }>;
  finish(job: BillingJob, result: JsonObject): Promise<unknown>;
};
type Stripe = ReturnType<typeof createFirstPublicationStripe>;
export async function processBillingJob(job: BillingJob, deps: { stripe: Stripe; store: WorkerStore; now: () => number; priceIds: Record<string,string> }, signal: AbortSignal) {
  const { stripe, store } = deps;
  if (!await store.dispatchCheck(job)) return { outcome:'blocked' };
  if (job.kind === 'cancel_conversion') {
    // No pre-deadline autonomous subscription exists. DB gate rejects cancellation after dispatch.
    return store.finish(job,{ outcome:'cancelled' });
  }
  const proof = await stripe.verifySetup(job.proof,signal);
  if (job.kind === 'synchronize_trial') return store.finish(job,{ outcome:'trial_ready' });
  demand(job.kind === 'start_paid' && deps.now() > Date.parse(job.trial_ends_at), 'DEADLINE_NOT_PASSED');
  demand(Number.isSafeInteger(job.amount_yen) && job.amount_yen > 0, 'INVALID_AMOUNT');
  const units=priceUnits(job.plan_key,job.amount_yen);
  const priceId = deps.priceIds[job.plan_key]; demand(priceId && /^price_[A-Za-z0-9]+$/.test(priceId), 'PRICE_NOT_CONFIGURED');
  const price = await stripe.call(`prices/${priceId}`,'GET',{},null,signal);
  demand(price.id === priceId && price.active === true && price.currency === 'jpy' && price.unit_amount === units.unitAmount && object(price.recurring) && price.recurring.interval === 'month' && price.recurring.interval_count === 1, 'PRICE_CONTRACT_MISMATCH');
  verifyVariablePrice(price,job.plan_key);
  const common: Record<string,string> = {
    'metadata[scheme]':'academy_first_publication_168h_v1', 'metadata[attempt_id]':job.proof.attempt_id,
    'metadata[headquarters_id]':job.proof.headquarters_id, 'metadata[owner_user_id]':job.proof.owner_user_id,
    'metadata[quote_id]':job.proof.quote_id,
  };
  async function step(name: string, path: string, params: Record<string,string>, retrievePath: (id: string) => string) {
    signal.throwIfAborted();
    demand(await store.dispatchCheck(job), 'DISPATCH_FENCE_REJECTED');
    const checkpoint = await store.checkpoint(job,name);
    demand(checkpoint.blocked !== true,'DISPATCH_FENCE_REJECTED');
    if (checkpoint.provider_id) return stripe.call(retrievePath(checkpoint.provider_id),'GET',{},null,signal);
    stripe.retryable(checkpoint.started_at); // Unknown outcome after provider TTL is a manual reconciliation gate.
    demand(checkpoint.operation_key.length > 0 && checkpoint.operation_key.length <= 255, 'INVALID_OPERATION_KEY');
    const value = await stripe.call(path,'POST',params,checkpoint.operation_key,signal);
    demand(typeof value.id === 'string' && /^[a-z]+_[A-Za-z0-9]+$/.test(value.id), 'INVALID_PROVIDER_ID');
    const saved=await store.checkpoint(job,name,value.id); demand(saved.blocked !== true,'DISPATCH_FENCE_REJECTED');
    return value;
  }
  let invoice = await step('invoice_create','invoices', {
    ...common, customer:proof.customerId, currency:'jpy', auto_advance:'false', collection_method:'charge_automatically',
    default_payment_method:proof.paymentMethodId, pending_invoice_items_behavior:'exclude', discounts:'', 'automatic_tax[enabled]':'false',
  }, id => `invoices/${id}`);
  const invoiceId = invoice.id;
  demand(typeof invoiceId === 'string' && /^in_[A-Za-z0-9]+$/.test(invoiceId), 'INVALID_INVOICE');
  function verifyInvoice(value: JsonObject, billed: boolean) {
    stripe.verifyScope(value,job.proof);
    demand(value.id === invoiceId && value.customer === proof.customerId && value.currency === 'jpy' && value.auto_advance === false, 'INVOICE_SCOPE_MISMATCH');
    if (billed) demand(value.total === job.amount_yen && value.amount_due === job.amount_yen && value.starting_balance === 0, 'INVOICE_AMOUNT_MISMATCH');
  }
  verifyInvoice(invoice,false);
  if (invoice.status === 'draft') {
    const item = await step('invoice_item','invoiceitems', { customer:proof.customerId, invoice:invoiceId, amount:String(job.amount_yen), currency:'jpy', discountable:'false', ...common }, id => `invoiceitems/${id}`);
    demand(item.customer === proof.customerId && item.invoice === invoiceId && item.amount === job.amount_yen && item.currency === 'jpy', 'INVOICE_ITEM_MISMATCH');
    invoice = await stripe.call(`invoices/${invoiceId}`,'GET',{},null,signal);
    verifyInvoice(invoice,true); // Validate the frozen total before any finalization/payment.
    invoice = await step('finalize',`invoices/${invoiceId}/finalize`,{ auto_advance:'false' }, id => `invoices/${id}`);
  }
  verifyInvoice(invoice,true);
  if (invoice.status === 'open') {
    invoice = await step('pay',`invoices/${invoiceId}/pay`,{ payment_method:proof.paymentMethodId, off_session:'true' }, id => `invoices/${id}`);
  }
  verifyInvoice(invoice,true);
  if (invoice.status !== 'paid') return store.finish(job,{ outcome:'attention',provider_invoice_id:invoiceId,reason:'payment_pending' });
  demand(invoice.amount_paid === job.amount_yen && invoice.amount_remaining === 0 && object(invoice.status_transitions), 'INVALID_PAID_INVOICE');
  const paidSeconds = invoice.status_transitions.paid_at;
  demand(Number.isSafeInteger(paidSeconds) && (paidSeconds as number) * 1000 >= Date.parse(job.trial_ends_at) && (paidSeconds as number)*1000 <= deps.now(), 'INVALID_PAID_TIME');
  const paidAt = (paidSeconds as number)*1000, periodEnd = nextPaidMonth(paidAt);
  demand(periodEnd > deps.now(), 'PAID_RENEWAL_RECOVERY_REQUIRED');
  // The first month was paid by the standalone invoice. No prorated second charge is allowed.
  let subscription = await step('subscription_create','subscriptions', {
    ...common, customer:proof.customerId, default_payment_method:proof.paymentMethodId,
    'items[0][price]':priceId, 'items[0][quantity]':String(units.quantity), billing_cycle_anchor:String(periodEnd/1000),
    proration_behavior:'none', payment_behavior:'error_if_incomplete', collection_method:'charge_automatically',
    discounts:'', 'automatic_tax[enabled]':'false',
    cancel_at:String(periodEnd/1000),
  }, id => `subscriptions/${id}`);
  stripe.verifyScope(subscription,job.proof);
  demand(typeof subscription.id === 'string' && /^sub_[A-Za-z0-9]+$/.test(subscription.id) && subscription.customer === proof.customerId && subscription.status === 'active' && subscription.billing_cycle_anchor === periodEnd/1000, 'SUBSCRIPTION_CONTRACT_MISMATCH');
  demand(object(subscription.items) && Array.isArray(subscription.items.data) && subscription.items.data.length === 1, 'SUBSCRIPTION_ITEMS_MISMATCH');
  const item = subscription.items.data[0];
  demand(object(item) && object(item.price) && item.price.id === priceId && item.quantity === units.quantity && (item.current_period_end ?? subscription.current_period_end) === periodEnd/1000, 'SUBSCRIPTION_PERIOD_MISMATCH');
  // Creation is fail-safe cancelled at the prepaid boundary until this atomic provider update succeeds.
  const createdSubscriptionId=subscription.id;
  subscription=await step('subscription_hold',`subscriptions/${createdSubscriptionId}`,{ 'pause_collection[behavior]':'keep_as_draft',cancel_at:'',proration_behavior:'none' },id=>`subscriptions/${id}`);
  stripe.verifyScope(subscription,job.proof);
  demand(subscription.id===createdSubscriptionId&&subscription.customer===proof.customerId&&object(subscription.pause_collection)&&subscription.pause_collection.behavior==='keep_as_draft'&&subscription.cancel_at===null,'SUBSCRIPTION_HOLD_NOT_CONFIRMED');
  const result = { outcome:'paid',provider_invoice_id:invoiceId,provider_subscription_id:subscription.id,provider_customer_id:proof.customerId,
    amount_yen:job.amount_yen,plan_key:job.plan_key,paid_at:new Date(paidAt).toISOString(),period_end:new Date(periodEnd).toISOString(),
    provider_result_hash:createHash('sha256').update(JSON.stringify({ invoiceId,paidAt,periodEnd,subscriptionId:subscription.id,amountYen:job.amount_yen })).digest('hex') };
  // DB must atomically activate Academy and register the subscription for the existing renewal webhook.
  return store.finish(job,result);
}
