import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { isCanonicalTime, isPlatformRedirect, isRecord, isResourceId } from './contracts';

const TOKEN = /^[a-z][a-z0-9_]{0,39}$/;
const SESSION = /^cs_(?:test|live)_[A-Za-z0-9]+$/;
const CUSTOMER = /^cus_[A-Za-z0-9]+$/;
const SUBSCRIPTION = /^sub_[A-Za-z0-9]+$/;
const EVENT = /^evt_[A-Za-z0-9]+$/;

export type StripeRuntimeConfig = Readonly<{
  mode: 'test' | 'live';
  secretKey: string;
  webhookSecret: string;
  successUrl: string;
  cancelUrl: string;
  portalReturnUrl: string;
  priceIds: Readonly<Record<string, string>>;
}>;

export type StripeActivationEvent = Readonly<{
  kind: 'activation'; eventId: string; eventHash: string; attemptId: string;
  sessionId: string; customerId: string; subscriptionId: string;
  amountTotal: number; currency: 'jpy'; paidAt: string;
}>;
export type StripeSubscriptionEvent = Readonly<{
  kind: 'invoice_paid' | 'invoice_failed' | 'subscription_state';
  eventId: string; eventHash: string; subscriptionId: string;
  status: 'active' | 'past_due' | 'ended'; periodStart: string; periodEnd: string;
  cancelAtPeriodEnd: boolean; occurredAt: string;
}>;
export type VerifiedStripeEvent = StripeActivationEvent | StripeSubscriptionEvent;

function httpsUrl(value: string, host: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === host && !url.username && !url.password; }
  catch { return false; }
}
function seconds(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) return null;
  const date = new Date(value * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function safeId(value: unknown, pattern: RegExp): value is string {
  return typeof value === 'string' && value.length <= 255 && pattern.test(value);
}
function parseJsonObject(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed)) throw new Error('STRIPE_INVALID_RESPONSE');
  return parsed;
}

export function readStripeRuntimeConfig(env: NodeJS.ProcessEnv = process.env): StripeRuntimeConfig {
  const mode = env.PLATFORM_BILLING_STRIPE_MODE;
  const secretKey = env.STRIPE_SECRET_KEY ?? '';
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET ?? '';
  const successUrl = env.PLATFORM_BILLING_STRIPE_SUCCESS_URL ?? '';
  const cancelUrl = env.PLATFORM_BILLING_STRIPE_CANCEL_URL ?? '';
  const portalReturnUrl = env.PLATFORM_BILLING_STRIPE_PORTAL_RETURN_URL ?? '';
  if ((mode !== 'test' && mode !== 'live')
    || !new RegExp(`^sk_${mode}_[A-Za-z0-9]+$`).test(secretKey)
    || !/^whsec_[A-Za-z0-9]+$/.test(webhookSecret)
    || !httpsUrl(successUrl, 'app.mikke-os.com')
    || !httpsUrl(cancelUrl, 'app.mikke-os.com')
    || !httpsUrl(portalReturnUrl, 'app.mikke-os.com')) throw new Error('BILLING_NOT_CONFIGURED');
  let raw: unknown;
  try { raw = JSON.parse(env.PLATFORM_BILLING_STRIPE_PRICES_JSON ?? ''); } catch { throw new Error('BILLING_NOT_CONFIGURED'); }
  if (!isRecord(raw) || Object.keys(raw).length < 1 || Object.keys(raw).length > 32) throw new Error('BILLING_NOT_CONFIGURED');
  const priceIds: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!/^(academy_platform|community_platform):[a-z][a-z0-9_]{0,39}$/.test(key)
      || typeof value !== 'string' || !/^price_[A-Za-z0-9]+$/.test(value)) throw new Error('BILLING_NOT_CONFIGURED');
    priceIds[key] = value;
  }
  return Object.freeze({ mode, secretKey, webhookSecret, successUrl, cancelUrl, portalReturnUrl, priceIds: Object.freeze(priceIds) });
}

type Fetch = typeof fetch;
async function requestStripe(
  config: StripeRuntimeConfig, path: string, init: RequestInit, signal: AbortSignal, fetcher: Fetch,
): Promise<Record<string, unknown>> {
  signal.throwIfAborted();
  const response = await fetcher(`https://api.stripe.com/v1/${path}`, {
    ...init, signal, redirect: 'error', cache: 'no-store',
    headers: { Authorization: `Bearer ${config.secretKey}`, ...init.headers },
  });
  const text = await response.text();
  if (!response.ok || text.length > 131072) throw new Error('STRIPE_UNAVAILABLE');
  return parseJsonObject(text);
}

export function createStripeProvider(config: StripeRuntimeConfig, fetcher: Fetch = fetch) {
  return Object.freeze({
    async createCheckout(input: Readonly<{ attemptId: string; productKey: string; planKey: string; idempotencyKey: string }>, signal: AbortSignal) {
      if (!isResourceId(input.attemptId) || input.idempotencyKey !== `platform-checkout-${input.attemptId}`
        || !TOKEN.test(input.planKey) || !['academy_platform','community_platform'].includes(input.productKey)) throw new Error('INVALID_REQUEST');
      const price = config.priceIds[`${input.productKey}:${input.planKey}`];
      if (!price) throw new Error('BILLING_NOT_CONFIGURED');
      const form = new URLSearchParams({
        mode: 'subscription', 'line_items[0][price]': price, 'line_items[0][quantity]': '1',
        client_reference_id: input.attemptId,
        'metadata[platform_attempt_id]': input.attemptId,
        'subscription_data[metadata][platform_attempt_id]': input.attemptId,
        success_url: config.successUrl, cancel_url: config.cancelUrl,
      });
      const raw = await requestStripe(config, 'checkout/sessions', {
        method: 'POST', body: form, headers: {
          'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': input.idempotencyKey,
        },
      }, signal, fetcher);
      const expiresAt = seconds(raw.expires_at);
      if (!safeId(raw.id, SESSION) || typeof raw.url !== 'string' || !isPlatformRedirect(raw.url, 'checkout') || !expiresAt)
        throw new Error('STRIPE_INVALID_RESPONSE');
      return Object.freeze({ id: raw.id as string, url: raw.url as string, expiresAt });
    },
    async retrieveCheckout(sessionId: string, signal: AbortSignal) {
      if (!safeId(sessionId, SESSION)) throw new Error('INVALID_REQUEST');
      const raw = await requestStripe(config, `checkout/sessions/${encodeURIComponent(sessionId)}`, { method: 'GET' }, signal, fetcher);
      const expiresAt = seconds(raw.expires_at);
      if (raw.id !== sessionId || typeof raw.url !== 'string' || !isPlatformRedirect(raw.url, 'checkout') || !expiresAt)
        throw new Error('STRIPE_INVALID_RESPONSE');
      return Object.freeze({ id: sessionId, url: raw.url, expiresAt });
    },
    async createPortal(customerId: string, signal: AbortSignal) {
      if (!safeId(customerId, CUSTOMER)) throw new Error('INVALID_REQUEST');
      const raw = await requestStripe(config, 'billing_portal/sessions', {
        method: 'POST', body: new URLSearchParams({ customer: customerId, return_url: config.portalReturnUrl }),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }, signal, fetcher);
      if (typeof raw.url !== 'string' || !isPlatformRedirect(raw.url, 'portal')) throw new Error('STRIPE_INVALID_RESPONSE');
      return raw.url;
    },
  });
}

export function verifyStripeEvent(
  rawBody: Uint8Array, signature: string | null, config: StripeRuntimeConfig,
  now = new Date(), toleranceSeconds = 300,
): VerifiedStripeEvent {
  if (!(rawBody instanceof Uint8Array) || rawBody.byteLength < 2 || rawBody.byteLength > 262144
    || typeof signature !== 'string' || signature.length > 4096 || !Number.isFinite(now.getTime())) throw new Error('INVALID_SIGNATURE');
  const parts = signature.split(',').map((part) => part.split('='));
  const timestampText = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key, value]) => key === 'v1' && /^[0-9a-f]{64}$/.test(value ?? '')).map(([, value]) => value!);
  if (!timestampText || !/^\d{10}$/.test(timestampText) || signatures.length < 1) throw new Error('INVALID_SIGNATURE');
  const timestamp = Number(timestampText);
  if (Math.abs(Math.floor(now.getTime() / 1000) - timestamp) > toleranceSeconds) throw new Error('INVALID_SIGNATURE');
  const body = new TextDecoder('utf-8', { fatal: true }).decode(rawBody);
  const expected = createHmac('sha256', config.webhookSecret).update(`${timestamp}.${body}`).digest();
  if (!signatures.some((value) => timingSafeEqual(expected, Buffer.from(value, 'hex')))) throw new Error('INVALID_SIGNATURE');
  const event = parseJsonObject(body);
  if (!safeId(event.id, EVENT) || event.livemode !== (config.mode === 'live') || !isRecord(event.data)
    || !isRecord(event.data.object)) throw new Error('INVALID_EVENT');
  const object = event.data.object;
  const occurredAt = seconds(event.created);
  const eventHash = createHash('sha256').update(rawBody).digest('hex');
  if (!occurredAt) throw new Error('INVALID_EVENT');
  if (event.type === 'checkout.session.completed') {
    if (object.mode !== 'subscription' || object.payment_status !== 'paid'
      || !isResourceId(object.client_reference_id) || !safeId(object.id, SESSION)
      || !safeId(object.customer, CUSTOMER) || !safeId(object.subscription, SUBSCRIPTION)
      || typeof object.amount_total!=='number' || !Number.isSafeInteger(object.amount_total) || object.amount_total<0
      || object.currency!=='jpy') throw new Error('INVALID_EVENT');
    return Object.freeze({ kind:'activation', eventId:event.id, eventHash, attemptId:object.client_reference_id.toLowerCase(),
      sessionId:object.id, customerId:object.customer, subscriptionId:object.subscription,
      amountTotal:object.amount_total,currency:'jpy',paidAt:occurredAt });
  }
  if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
    const periodStart=seconds(object.period_start), periodEnd=seconds(object.period_end);
    if (!safeId(object.subscription,SUBSCRIPTION) || !periodStart || !periodEnd || periodEnd<=periodStart) throw new Error('INVALID_EVENT');
    return Object.freeze({ kind:event.type==='invoice.paid'?'invoice_paid':'invoice_failed',eventId:event.id,eventHash,
      subscriptionId:object.subscription,status:event.type==='invoice.paid'?'active':'past_due',periodStart,periodEnd,
      cancelAtPeriodEnd:false,occurredAt });
  }
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const periodStart=seconds(object.current_period_start), periodEnd=seconds(object.current_period_end);
    if (!safeId(object.id,SUBSCRIPTION) || !periodStart || !periodEnd || periodEnd<=periodStart
      || typeof object.cancel_at_period_end!=='boolean') throw new Error('INVALID_EVENT');
    const status=event.type==='customer.subscription.deleted'?'ended':object.status==='active'?'active':object.status==='past_due'?'past_due':null;
    if (!status) throw new Error('INVALID_EVENT');
    return Object.freeze({ kind:'subscription_state',eventId:event.id,eventHash,subscriptionId:object.id,status,
      periodStart,periodEnd,cancelAtPeriodEnd:object.cancel_at_period_end,occurredAt });
  }
  throw new Error('UNSUPPORTED_EVENT');
}
