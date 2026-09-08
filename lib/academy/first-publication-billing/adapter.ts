import 'server-only';
import { createHash } from 'node:crypto';

export const SCHEME = 'academy_first_publication_168h_v1' as const;
export type Policy = Readonly<{
  approvalId: string; version: string; eligibilityRule: string; priceRule: string;
  cancellationBoundary: 'inclusive' | 'exclusive';
  lateSync: 'hold';
}>;
export type Enrollment = {
  id: string; hqId: string; scheme: string; explicitConsent: boolean;
  policyVersion: string; eligible: boolean; customerId: string; quoteId: string;
  priceId: string; quoteValidUntil: number; preparedId: string | null;
  publishedAt: number | null; trialEndsAt: number | null;
  cancellationReceivedAt: number | null;
  providerId: string | null; status: 'unprepared' | 'prepared' | 'sync_pending' | 'held' | 'payment_pending' | 'paid' | 'cancelled' | 'review';
  paidAt: number | null;
};
export type ProviderSnapshot = {
  id: string; enrollmentId: string; customerId: string;
  status: 'held' | 'payment_pending' | 'paid' | 'cancelled'; paidAt: number | null;
};
export interface Provider {
  // Preparation must only save a payment method, never start a subscription or charge.
  prepare(input: { enrollmentId: string; customerId: string; key: string }): Promise<{ id: string; customerId: string; succeeded: boolean }>;
  // Must durably reconcile by operation key, even beyond the provider's idempotency TTL.
  // A held reservation MUST NOT autonomously charge at trialEndsAt.
  ensureHeld(input: { enrollmentId: string; customerId: string; preparedId: string; priceId: string; trialEndsAt: number; key: string }): Promise<ProviderSnapshot>;
  retrieve(id: string): Promise<ProviderSnapshot>;
  cancel(id: string): Promise<ProviderSnapshot>;
}
export interface Repository {
  // Durable per-HQ serialization shared with publication, cancellation intake and workers.
  // Commit save() before returning; rollback must not erase a persisted cancellation intent.
  withEnrollment<T>(id: string, action: (row: Enrollment, save: (row: Enrollment) => Promise<void>) => Promise<T>): Promise<T>;
}
const key = (id: string, operation: string) => `afp-${operation}-${createHash('sha256').update(`${SCHEME}:${id}`).digest('hex')}`;
function requirePolicy(policy: Policy | null): Policy {
  if (!policy?.approvalId?.trim() || !policy.version?.trim() || !policy.eligibilityRule?.trim() || !policy.priceRule?.trim()
    || !['inclusive', 'exclusive'].includes(policy.cancellationBoundary) || policy.lateSync !== 'hold') throw new Error('POLICY_NOT_APPROVED');
  return policy;
}
function validate(row: Enrollment, policy: Policy) {
  if (row.scheme !== SCHEME || !row.explicitConsent || !row.eligible || row.policyVersion !== policy.version) throw new Error('ENROLLMENT_NOT_ELIGIBLE');
  if (![row.id, row.hqId, row.customerId, row.quoteId, row.priceId].every(v => typeof v === 'string' && v.length > 0)) throw new Error('INVALID_ENROLLMENT');
}
function verify(snapshot: ProviderSnapshot, row: Enrollment, expectedId?: string) {
  if (!snapshot.id || snapshot.enrollmentId !== row.id || snapshot.customerId !== row.customerId || (expectedId && snapshot.id !== expectedId)) throw new Error('PROVIDER_SCOPE_MISMATCH');
  if (!['held', 'payment_pending', 'paid', 'cancelled'].includes(snapshot.status)) throw new Error('INVALID_PROVIDER_STATE');
  if (snapshot.status === 'paid' && (!Number.isSafeInteger(snapshot.paidAt) || snapshot.paidAt! < row.trialEndsAt!)) throw new Error('INVALID_PAID_AT');
}
export function createFirstPublicationBilling(deps: { repository: Repository; provider: Provider; policy: Policy | null; now: () => number }) {
  const run = <T>(id: string, fn: (row: Enrollment, save: (row: Enrollment) => Promise<void>, policy: Policy) => Promise<T>) => {
    const policy = requirePolicy(deps.policy);
    return deps.repository.withEnrollment(id, async (row, save) => {
      validate(row, policy);
      const now = deps.now();
      if (!Number.isSafeInteger(now) || now <= 0 || (row.cancellationReceivedAt !== null &&
        (!Number.isSafeInteger(row.cancellationReceivedAt) || row.cancellationReceivedAt < 0 || row.cancellationReceivedAt > now))) throw new Error('INVALID_SERVER_TIME');
      return fn(row, save, policy);
    });
  };
  return {
    prepare(id: string) {
      return run(id, async (row, save) => {
        if (row.cancellationReceivedAt !== null) throw new Error('CANCELLED');
        if (row.preparedId) return row;
        if (row.publishedAt !== null || !Number.isSafeInteger(row.quoteValidUntil) || deps.now() >= row.quoteValidUntil) throw new Error('RECONFIRM_REQUIRED');
        const receipt = await deps.provider.prepare({ enrollmentId: row.id, customerId: row.customerId, key: key(row.id, 'setup') });
        if (!receipt.id || receipt.customerId !== row.customerId || !receipt.succeeded) throw new Error('PAYMENT_METHOD_NOT_READY');
        row = { ...row, preparedId: receipt.id, status: 'prepared' };
        await save(row);
        return row;
      });
    },
    synchronize(id: string) {
      return run(id, async (row, save, policy) => {
        if (row.publishedAt === null) return row; // A failed publication starts nothing.
        if (!Number.isSafeInteger(row.publishedAt) || row.trialEndsAt !== row.publishedAt + 168 * 3600 * 1000 || row.publishedAt > deps.now() || !row.preparedId) throw new Error('INVALID_PUBLICATION_RECEIPT');
        const cancelled = row.cancellationReceivedAt !== null && (policy.cancellationBoundary === 'inclusive'
          ? row.cancellationReceivedAt <= row.trialEndsAt : row.cancellationReceivedAt < row.trialEndsAt);
        if (cancelled) {
          if (row.providerId) {
            const current = await deps.provider.retrieve(row.providerId);
            verify(current, row, row.providerId);
            // A provider-side charge despite an accepted cancellation is an incident, not paid access.
            if (current.status === 'paid') { row = { ...row, status: 'review' }; await save(row); return row; }
            const stopped = await deps.provider.cancel(row.providerId);
            verify(stopped, row, row.providerId);
            if (stopped.status !== 'cancelled') throw new Error('CANCELLATION_NOT_CONFIRMED');
          }
          row = { ...row, status: 'cancelled', paidAt: null }; await save(row); return row;
        }
        if (!row.providerId && deps.now() >= row.trialEndsAt) {
          row = { ...row, status: 'review' }; await save(row); return row; // No backdated or immediate surprise charge.
        }
        let current: ProviderSnapshot;
        if (row.providerId) current = await deps.provider.retrieve(row.providerId);
        else {
          row = { ...row, status: 'sync_pending' }; await save(row);
          current = await deps.provider.ensureHeld({ enrollmentId: row.id, customerId: row.customerId, preparedId: row.preparedId!, priceId: row.priceId, trialEndsAt: row.trialEndsAt!, key: key(row.id, 'reservation') });
        }
        verify(current, row, row.providerId ?? undefined);
        if (current.status === 'paid' && current.paidAt! > deps.now()) throw new Error('INVALID_PAID_AT');
        row = { ...row, providerId: current.id, status: current.status, paidAt: current.status === 'paid' ? current.paidAt : null };
        await save(row); return row;
      });
    },
    // Only call after signature validation and server-side provider-ID -> enrollment lookup.
    // Payload status/time is deliberately ignored; duplicate/out-of-order notifications reread current state.
    reconcileVerifiedNotification(id: string) { return this.synchronize(id); },
  };
}
