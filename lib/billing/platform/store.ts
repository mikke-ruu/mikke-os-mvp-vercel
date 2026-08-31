// Server-only dependency adapter. A privileged RPC transport is supplied by the server;
// never construct it from a browser token, expose it to the UI, or log raw responses.
import { hasExactKeys, isRecord, isResourceId } from './contracts';
import { CheckoutExecutionError } from './checkout';
import type { CheckoutAttempt, ReservedAttempt, CheckoutExecutionDependencies } from './checkout';
import { validatePlatformBillingQuote } from './quote';
import type { BillingSelection } from './quote';

export type BillingRpc = (name: string, args: Record<string, unknown>, signal: AbortSignal) => Promise<{ data: unknown; error: null | { code?: string } }>;
function fail(): never { throw new CheckoutExecutionError('BILLING_NOT_CONFIGURED'); }
const keys = ['attempt_id','quote_id','quote_revision','status','provider_idempotency_key','provider_session_id','provider_result_hash'];
function attempt(raw: unknown, reserved: true): ReservedAttempt;
function attempt(raw: unknown, reserved: false): CheckoutAttempt;
function attempt(raw: unknown, reserved: boolean): CheckoutAttempt | ReservedAttempt {
  if (!isRecord(raw) || !hasExactKeys(raw, reserved ? [...keys,'created'] : keys)
    || !isResourceId(raw.attempt_id) || typeof raw.quote_id !== 'string' || raw.quote_id.length > 128
    || typeof raw.quote_revision !== 'number' || !Number.isSafeInteger(raw.quote_revision) || raw.quote_revision < 1
    || raw.provider_idempotency_key !== `platform-checkout-${raw.attempt_id}`
    || typeof raw.status !== 'string' || !['prepared','provider_ready','uncertain'].includes(raw.status)
    || (reserved && typeof raw.created !== 'boolean')) fail();
  if (raw.status === 'provider_ready') {
    if (typeof raw.provider_session_id !== 'string' || !/^cs_test_[A-Za-z0-9]+$/.test(raw.provider_session_id)
      || typeof raw.provider_result_hash !== 'string' || !/^[a-f0-9]{64}$/.test(raw.provider_result_hash)) fail();
  } else if (raw.provider_session_id !== null || raw.provider_result_hash !== null) fail();
  return raw as CheckoutAttempt | ReservedAttempt;
}
export function createCheckoutStore(rpc: BillingRpc): Pick<CheckoutExecutionDependencies, 'loadQuote'|'reserve'|'markReady'|'markUncertain'> & {
  saveQuote(quote: unknown, expected: BillingSelection, now: Date, signal: AbortSignal): Promise<void>;
} {
  async function invoke(name: string, actor: string, args: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
    if (!isResourceId(actor)) throw new CheckoutExecutionError('INVALID_REQUEST');
    signal.throwIfAborted();
    let response;
    try { response = await rpc(name, { ...args, p_actor_user_id: actor }, signal); }
    catch { return fail(); }
    signal.throwIfAborted();
    if (!isRecord(response) || !hasExactKeys(response, ['data','error'])
      || (response.error !== null && (!isRecord(response.error) || typeof response.error.code !== 'string'))) fail();
    if (response.error) {
      if (['23505','22023','P0002','42501'].includes(response.error.code ?? '')) throw new CheckoutExecutionError('STATE_CONFLICT');
      fail();
    }
    return response.data;
  }
  return {
    async saveQuote(raw, expected, now, signal) {
      const validated = validatePlatformBillingQuote(raw, expected, now);
      if (!validated.ok) throw new CheckoutExecutionError('POLICY_PENDING');
      const result = await invoke('platform_billing_quote_save', expected.ownerUserId, { p_quote: validated.quote }, signal);
      if (!isRecord(result) || !hasExactKeys(result, ['quote_id','revision'])
        || result.quote_id !== validated.quote.quoteId || result.revision !== validated.quote.revision) fail();
    },
    loadQuote: (actor, id, signal) => invoke('platform_billing_quote_get', actor, {p_quote_id:id}, signal),
    async reserve(actor, id, consent, signal) {
      return attempt(await invoke('platform_billing_attempt_reserve', actor, {p_quote_id:id,p_consent:consent}, signal), true);
    },
    async markReady(actor, id, session, hash, signal) {
      return attempt(await invoke('platform_billing_attempt_mark_ready', actor,
        {p_attempt_id:id,p_provider_session_id:session,p_provider_result_hash:hash},signal), false);
    },
    async markUncertain(actor, id, signal) {
      return attempt(await invoke('platform_billing_attempt_mark_uncertain', actor, {p_attempt_id:id},signal), false);
    }
  };
}
