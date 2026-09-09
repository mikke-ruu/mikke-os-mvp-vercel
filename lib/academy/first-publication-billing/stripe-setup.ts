import 'server-only';
import { createHash } from 'node:crypto';
export type SetupScope = Readonly<{ attemptId: string; headquartersId: string; ownerUserId: string; quoteId: string; customerId: string }>;
type Config = { secretKey: string; mode: 'test' | 'live'; approvalId: string; apiVersion: string };
function valid(scope: SetupScope) {
  if (!Object.values(scope).every(v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(v)) || !/^cus_[A-Za-z0-9]+$/.test(scope.customerId)) throw new Error('INVALID_SETUP_SCOPE');
}
const metadata = (s: SetupScope) => ({ scheme: 'academy_first_publication_168h_v1', attempt_id: s.attemptId, headquarters_id: s.headquartersId, owner_user_id: s.ownerUserId, quote_id: s.quoteId });
export function createStripeSetupTransport(config: Config, request: typeof fetch) {
  if (!config.approvalId?.trim() || !['test', 'live'].includes(config.mode) || !config.secretKey.startsWith(`sk_${config.mode}_`) || !/^\d{4}-\d{2}-\d{2}(?:\.[a-z]+)?$/.test(config.apiVersion)) throw new Error('SETUP_CONFIG_NOT_APPROVED');
  async function call(path: string, init: RequestInit, signal: AbortSignal): Promise<Record<string, unknown>> {
    const response = await request(`https://api.stripe.com/v1/setup_intents${path}`, { ...init, redirect: 'error', signal, headers: { Authorization: `Bearer ${config.secretKey}`, 'Stripe-Version': config.apiVersion, ...init.headers } });
    if (!response.ok) throw new Error(`STRIPE_SETUP_HTTP_${response.status}`);
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_SETUP_RESPONSE');
    return value as Record<string, unknown>;
  }
  function verify(v: Record<string, unknown>, scope: SetupScope, expected?: string) {
    const meta = v.metadata as Record<string, unknown> | null;
    if (typeof v.id !== 'string' || !/^seti_[A-Za-z0-9]+$/.test(v.id) || (expected && v.id !== expected) || v.object !== 'setup_intent' || v.livemode !== (config.mode === 'live') || v.customer !== scope.customerId || v.usage !== 'off_session' || !meta || !Object.entries(metadata(scope)).every(([k,value]) => meta[k] === value)) throw new Error('SETUP_SCOPE_MISMATCH');
    return v.id;
  }
  return {
    async create(scope: SetupScope, signal: AbortSignal) {
      valid(scope);
      const body = new URLSearchParams({ customer: scope.customerId, usage: 'off_session', 'payment_method_types[0]': 'card' });
      for (const [k,v] of Object.entries(metadata(scope))) body.set(`metadata[${k}]`, v);
      const key = `afp-setup-${createHash('sha256').update(JSON.stringify([scope.attemptId, scope.headquartersId, scope.ownerUserId, scope.quoteId, scope.customerId])).digest('hex')}`;
      const value = await call('', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': key }, body }, signal);
      const id = verify(value, scope);
      if (typeof value.client_secret !== 'string' || !value.client_secret.startsWith(`${id}_secret_`)) throw new Error('INVALID_SETUP_SECRET');
      // Only return the secret to the authenticated contract owner; never put it in shared logs.
      return { id, clientSecret: value.client_secret, ready: false as const };
    },
    async verifyCompleted(id: string, scope: SetupScope, signal: AbortSignal) {
      valid(scope);
      if (!/^seti_[A-Za-z0-9]+$/.test(id)) throw new Error('INVALID_SETUP_ID');
      const value = await call(`/${encodeURIComponent(id)}`, { method: 'GET' }, signal);
      verify(value, scope, id);
      if (value.status !== 'succeeded' || typeof value.payment_method !== 'string' || !/^pm_[A-Za-z0-9]+$/.test(value.payment_method)) throw new Error('PAYMENT_METHOD_NOT_READY');
      return { id, headquartersId: scope.headquartersId, ownerUserId: scope.ownerUserId, quoteId: scope.quoteId, customerId: scope.customerId, paymentMethodId: value.payment_method, verified: true as const, revoked: false as const };
    },
    async ensureHeld(): Promise<never> { throw new Error('STRIPE_NON_CHARGING_RESERVATION_UNSUPPORTED'); },
    async dispatchFirstCharge(): Promise<never> { throw new Error('FIRST_CHARGE_POLICY_AND_SERIALIZATION_REQUIRED'); },
  };
}
