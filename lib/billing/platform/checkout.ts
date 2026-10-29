// Server orchestration only. No provider credentials or application entitlement writes.
import { createHash } from 'node:crypto';
import { hasExactKeys, isRecord, isResourceId, isPlatformRedirect, isCanonicalTime, parseCheckout } from './contracts';
import type { CheckoutRequestV0 } from './contracts';
import { validatePlatformBillingConsent } from './quote';
import type { BillingSelection, PlatformBillingQuote } from './quote';

export type CheckoutAttempt = {
  attempt_id: string; quote_id: string; quote_revision: number;
  status: 'prepared' | 'provider_ready' | 'uncertain';
  provider_idempotency_key: string;
  provider_session_id: string | null; provider_result_hash: string | null;
};
export type ReservedAttempt = CheckoutAttempt & { created: boolean };
export type TestCheckoutSession = { id: string; url: string; expiresAt: string };
export type CheckoutResult = { state: 'redirect'; redirectUrl: string } | { state: 'pending' };
export type CheckoutExecutionDependencies = {
  providerMode: 'test' | 'live';
  // Must freshly authorize owner/resource and existing paid contracts, using server policy registry.
  selectAuthorizedContext(input: CheckoutRequestV0, signal: AbortSignal): Promise<BillingSelection>;
  loadQuote(ownerUserId: string, quoteId: string, signal: AbortSignal): Promise<unknown>;
  reserve(ownerUserId: string, quoteId: string, consent: unknown, signal: AbortSignal): Promise<ReservedAttempt>;
  markReady(ownerUserId: string, attemptId: string, sessionId: string, resultHash: string, signal: AbortSignal): Promise<CheckoutAttempt>;
  markUncertain(ownerUserId: string, attemptId: string, signal: AbortSignal): Promise<CheckoutAttempt>;
  // Implementations use server-owned price/customer/return URL, never request parameters.
  createTestSession(quote: PlatformBillingQuote, idempotencyKey: string, signal: AbortSignal): Promise<unknown>;
  retrieveTestSession(sessionId: string, quote: PlatformBillingQuote, signal: AbortSignal): Promise<unknown>;
  now(): Date;
};
export class CheckoutExecutionError extends Error {
  readonly code: 'INVALID_REQUEST' | 'POLICY_PENDING' | 'STATE_CONFLICT' | 'BILLING_NOT_CONFIGURED';
  constructor(code: CheckoutExecutionError['code']) {
    super(code); this.code = code;
  }
}
function error(code: CheckoutExecutionError['code']): never { throw new CheckoutExecutionError(code); }
const pending = (): CheckoutResult => ({ state: 'pending' });

function checkedSession(raw: unknown, now: Date, providerMode: 'test' | 'live'): TestCheckoutSession | null {
  if (!isRecord(raw) || !hasExactKeys(raw, ['id', 'url', 'expiresAt'])
    || typeof raw.id !== 'string' || !new RegExp(`^cs_${providerMode}_[A-Za-z0-9]+$`).test(raw.id)
    || !isPlatformRedirect(raw.url, 'checkout') || !isCanonicalTime(raw.expiresAt)
    || !Number.isFinite(now.getTime()) || Date.parse(raw.expiresAt) <= now.getTime()) return null;
  return { id: raw.id, url: raw.url, expiresAt: raw.expiresAt };
}
export function checkoutSessionHash(session: TestCheckoutSession): string {
  return createHash('sha256').update(JSON.stringify([session.id, session.url, session.expiresAt])).digest('hex');
}
function matchesAttempt(value: unknown, quote: PlatformBillingQuote, providerMode: 'test' | 'live'): value is CheckoutAttempt {
  if (!isRecord(value) || !isResourceId(value.attempt_id) || value.quote_id !== quote.quoteId
    || value.quote_revision !== quote.revision || typeof value.provider_idempotency_key !== 'string'
    || value.provider_idempotency_key !== `platform-checkout-${value.attempt_id}`
    || !['prepared', 'provider_ready', 'uncertain'].includes(value.status as string)) return false;
  return value.status === 'provider_ready'
    ? typeof value.provider_session_id === 'string' && new RegExp(`^cs_${providerMode}_[A-Za-z0-9]+$`).test(value.provider_session_id)
      && typeof value.provider_result_hash === 'string' && /^[a-f0-9]{64}$/.test(value.provider_result_hash)
    : value.provider_session_id === null && value.provider_result_hash === null;
}

/** Not mounted on v0 HTTP. Neither a returned URL nor this function grants paid access. */
export async function executeTestCheckout(
  raw: unknown, dependencies: CheckoutExecutionDependencies, signal: AbortSignal
): Promise<CheckoutResult> {
  if (!isRecord(raw) || !hasExactKeys(raw, ['version', 'product', 'resourceId', 'planKey', 'requestId', 'consent'])
    || raw.version !== 1 || !isRecord(raw.consent) || typeof raw.consent.quoteId !== 'string') error('INVALID_REQUEST');
  const input = parseCheckout({ product: raw.product, resourceId: raw.resourceId, planKey: raw.planKey, requestId: raw.requestId });
  if (!input) error('INVALID_REQUEST');
  signal.throwIfAborted();
  const context = await dependencies.selectAuthorizedContext(input, signal);
  if (context.productKey !== input.product || context.resourceId !== input.resourceId
    || context.planKey !== input.planKey || context.requestId !== input.requestId || !isResourceId(context.ownerUserId)) error('STATE_CONFLICT');
  const stored = await dependencies.loadQuote(context.ownerUserId, raw.consent.quoteId, signal);
  const validated = validatePlatformBillingConsent(stored, context, raw.consent, dependencies.now());
  if (!validated.ok) error(validated.code === 'POLICY_CHANGED' || validated.code === 'POLICY_UNAPPROVED' ? 'POLICY_PENDING' : 'STATE_CONFLICT');
  // Freeze and detach browser consent before any async persistence call.
  const consent = Object.freeze({ quoteId: validated.quote.quoteId, revision: validated.quote.revision,
    termsVersion: validated.quote.policies.terms.version, accepted: true as const });
  signal.throwIfAborted();
  const attempt = await dependencies.reserve(context.ownerUserId, validated.quote.quoteId, consent, signal);
  if (!matchesAttempt(attempt, validated.quote, dependencies.providerMode) || typeof attempt.created !== 'boolean') error('BILLING_NOT_CONFIGURED');
  if (!attempt.created) {
    // Prepared may already have sent the provider request. Never start again on timeout/crash.
    // Recovery is explicit reconciliation, with the persisted key and provider retention window.
    if (attempt.status !== 'provider_ready') return pending();
    try {
      const session = checkedSession(await dependencies.retrieveTestSession(attempt.provider_session_id!, validated.quote, signal), dependencies.now(), dependencies.providerMode);
      if (!session || session.id !== attempt.provider_session_id || checkoutSessionHash(session) !== attempt.provider_result_hash) return pending();
      return { state: 'redirect', redirectUrl: session.url };
    } catch { return pending(); }
  }
  if (attempt.status !== 'prepared') error('BILLING_NOT_CONFIGURED');
  try {
    signal.throwIfAborted();
    // Recheck scope/current policy immediately before first provider call.
    const current = await dependencies.selectAuthorizedContext(input, signal);
    const revalidated = validatePlatformBillingConsent(validated.quote, current, consent, dependencies.now());
    if (!revalidated.ok) throw new Error('context changed');
    const session = checkedSession(await dependencies.createTestSession(validated.quote, attempt.provider_idempotency_key, signal), dependencies.now(), dependencies.providerMode);
    if (!session) throw new Error('invalid provider response');
    const hash = checkoutSessionHash(session);
    // Persist even if the browser disconnects; failure remains prepared/uncertain, never auto-retry.
    const saved = await dependencies.markReady(context.ownerUserId, attempt.attempt_id, session.id, hash, AbortSignal.timeout(10000));
    if (!matchesAttempt(saved, validated.quote, dependencies.providerMode) || saved.attempt_id !== attempt.attempt_id
      || saved.status !== 'provider_ready' || saved.provider_session_id !== session.id || saved.provider_result_hash !== hash) return pending();
    return { state: 'redirect', redirectUrl: session.url };
  } catch {
    try { await dependencies.markUncertain(context.ownerUserId, attempt.attempt_id, AbortSignal.timeout(10000)); }
    catch { /* prepared also remains locked for reconciliation; never log raw provider errors */ }
    return pending();
  }
}
