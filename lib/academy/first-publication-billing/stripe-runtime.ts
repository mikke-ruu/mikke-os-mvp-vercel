import 'server-only';
import { createHash } from 'node:crypto';

export type StripeConfig = {
  secretKey: string; mode: 'test' | 'live'; apiVersion: string;
  successUrl: string; cancelUrl: string; approvalId: string;
};
export type SetupAttempt = {
  attempt_id: string; started_at: string; owner_user_id: string; headquarters_id: string;
  quote_id: string; amount_yen: number; policy_version: string;
  provider_customer_id: string | null; checkout_session_id: string | null;
  setup_intent_id: string | null; payment_method_id: string | null; status: string;
};
export type JsonObject = Record<string, unknown>;
export const object = (v: unknown): v is JsonObject => !!v && typeof v === 'object' && !Array.isArray(v);
export function demand(v: unknown, code: string): asserts v { if (!v) throw new Error(code); }
const identifier = (v: unknown, prefix: string): v is string => typeof v === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9]+$`).test(v);
const key = (scope: string, step: string) => `afp-${step}-${createHash('sha256').update(scope).digest('hex')}`;
export function nextPaidMonth(paidAt: number): number {
  const jst = new Date(paidAt + 9 * 3600000), year = jst.getUTCFullYear(), month = jst.getUTCMonth();
  const day = Math.min(jst.getUTCDate(), new Date(Date.UTC(year, month + 2, 0)).getUTCDate());
  return Date.UTC(year, month + 1, day, jst.getUTCHours(), jst.getUTCMinutes(), jst.getUTCSeconds()) - 9 * 3600000;
}
export function createFirstPublicationStripe(config: StripeConfig, request: typeof fetch, now: () => number) {
  demand(config.approvalId && ['test','live'].includes(config.mode) && config.secretKey.startsWith(`sk_${config.mode}_`) && config.apiVersion==='2025-02-24.acacia', 'STRIPE_NOT_CONFIGURED');
  for (const value of [config.successUrl, config.cancelUrl]) {
    const u = new URL(value);
    demand(u.protocol === 'https:' && ['app.mikke-os.com','mikke-os.com'].includes(u.hostname) && !u.username && !u.password && !u.port && u.pathname === '/academy/settings' && !u.search && !u.hash, 'INVALID_RETURN_URL');
  }
  async function call(path: string, method: 'GET'|'POST', params: Record<string,string>, operationKey: string | null, signal: AbortSignal) {
    const query = new URLSearchParams(params);
    const response = await request(`https://api.stripe.com/v1/${path}${method === 'GET' && query.size ? `?${query}` : ''}`, {
      method, cache: 'no-store', redirect: 'error', signal,
      headers: { Authorization: `Bearer ${config.secretKey}`, 'Stripe-Version': config.apiVersion,
        ...(method === 'POST' ? { 'Content-Type':'application/x-www-form-urlencoded', 'Idempotency-Key':operationKey! } : {}) },
      ...(method === 'POST' ? { body: query } : {}),
    });
    demand(response.ok, `STRIPE_HTTP_${response.status}`);
    const value: unknown = await response.json(); demand(object(value), 'INVALID_STRIPE_RESPONSE'); return value;
  }
  const meta = (a: SetupAttempt) => ({ scheme:'academy_first_publication_168h_v1', attempt_id:a.attempt_id, headquarters_id:a.headquarters_id, owner_user_id:a.owner_user_id, quote_id:a.quote_id });
  function matching(v: JsonObject, a: SetupAttempt) {
    const m = v.metadata;
    demand(v.livemode === (config.mode === 'live') && object(m) && Object.entries(meta(a)).every(([k,value]) => m[k] === value), 'PROVIDER_SCOPE_MISMATCH');
  }
  function retryable(started: string) {
    const elapsed = now() - Date.parse(started);
    demand(Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 23 * 3600000, 'PROVIDER_UNKNOWN_RECONCILIATION_REQUIRED');
  }
  return {
    mode:config.mode,
    async setup(a: SetupAttempt, attach: (customerId: string, sessionId: string | null, setupId?: string) => Promise<void>, signal: AbortSignal) {
      let customer = a.provider_customer_id;
      if (!customer) {
        retryable(a.started_at);
        const params: Record<string,string> = {};
        for (const [k,v] of Object.entries(meta(a))) params[`metadata[${k}]`] = v;
        const created = await call('customers','POST',params,key(a.attempt_id,'customer'),signal);
        demand(identifier(created.id,'cus') && object(created.metadata) && Object.entries(meta(a)).every(([k,v]) => (created.metadata as JsonObject)[k] === v), 'PROVIDER_SCOPE_MISMATCH');
        customer = created.id; await attach(customer,null);
      }
      demand(identifier(customer,'cus'), 'INVALID_CUSTOMER');
      let session: JsonObject;
      if (a.checkout_session_id) {
        demand(/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(a.checkout_session_id), 'INVALID_SESSION');
        session = await call(`checkout/sessions/${a.checkout_session_id}`,'GET',{},null,signal);
      } else {
        retryable(a.started_at);
        const returnUrl=(base:string,state:string)=>{const u=new URL(base);u.pathname=`/academy/h/${a.headquarters_id}/manage/settings`;u.searchParams.set('billing',state);u.searchParams.set('quoteId',a.quote_id);u.searchParams.set('attemptId',a.attempt_id);return u.href;};
        const params: Record<string,string> = { mode:'setup', customer, currency:'jpy', 'payment_method_types[0]':'card', success_url:returnUrl(config.successUrl,'setup_return'), cancel_url:returnUrl(config.cancelUrl,'setup_cancel'), client_reference_id:a.attempt_id };
        for (const [k,v] of Object.entries(meta(a))) { params[`metadata[${k}]`] = v; params[`setup_intent_data[metadata][${k}]`] = v; }
        session = await call('checkout/sessions','POST',params,key(a.attempt_id,'checkout-setup'),signal);
        demand(typeof session.id === 'string' && /^cs_(?:test|live)_[A-Za-z0-9]+$/.test(session.id), 'INVALID_SESSION');
        matching(session,a); demand(session.customer === customer && session.mode === 'setup' && session.client_reference_id === a.attempt_id, 'PROVIDER_SCOPE_MISMATCH');
        await attach(customer,session.id,identifier(session.setup_intent,'seti') ? session.setup_intent : undefined);
      }
      matching(session,a); demand(session.customer === customer && session.mode === 'setup' && session.client_reference_id === a.attempt_id, 'PROVIDER_SCOPE_MISMATCH');
      demand(session.status === 'open' && typeof session.url === 'string', 'SETUP_NOT_OPEN');
      const url = new URL(session.url);
      demand(url.protocol === 'https:' && url.hostname === 'checkout.stripe.com' && !url.username && !url.password && !url.port, 'INVALID_SETUP_URL');
      return { attemptId:a.attempt_id, setupUrl:url.href };
    },
    async verifySetup(a: SetupAttempt, signal: AbortSignal) {
      demand(a.checkout_session_id && /^cs_(?:test|live)_[A-Za-z0-9]+$/.test(a.checkout_session_id), 'SETUP_NOT_FOUND');
      const session = await call(`checkout/sessions/${a.checkout_session_id}`,'GET',{},null,signal);
      matching(session,a);
      demand(session.id === a.checkout_session_id && session.mode === 'setup' && session.status === 'complete' && session.client_reference_id === a.attempt_id && session.customer === a.provider_customer_id && identifier(session.setup_intent,'seti'), 'PAYMENT_METHOD_NOT_READY');
      const proof = await call(`setup_intents/${session.setup_intent}`,'GET',{},null,signal);
      matching(proof,a);
      demand(proof.id === session.setup_intent && proof.status === 'succeeded' && proof.usage === 'off_session' && proof.customer === a.provider_customer_id && identifier(proof.payment_method,'pm'), 'PAYMENT_METHOD_NOT_READY');
      return { customerId:a.provider_customer_id!, setupIntentId:session.setup_intent, paymentMethodId:proof.payment_method };
    },
    call,
    verifyScope: matching,
    operationKey: key,
    retryable,
  };
}
