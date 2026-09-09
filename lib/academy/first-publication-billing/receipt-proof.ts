import 'server-only';
import type { BillingJob } from './worker';
import { demand, object } from './stripe-runtime';

type Rpc = (name: string, args: Record<string, unknown>) => Promise<unknown>;

// Each RPC must finish its own transaction. Never combine these into one SQL call.
// This does not activate dispatch; the database's independent release gate remains.
export async function prepareReceiptProof(job: BillingJob, rpc: Rpc): Promise<boolean> {
  if (job.kind !== 'start_paid') return true;
  const barrier = await rpc('academy_first_publication_receipt_barrier', {
    p_headquarters_id: job.proof.headquarters_id,
  });
  demand(object(barrier) && barrier.status === 'awaiting_commit' &&
    typeof barrier.barrier_id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(barrier.barrier_id), 'INVALID_RECEIPT_BARRIER');
  const proof = await rpc('academy_first_publication_receipt_prove', {
    p_barrier_id: barrier.barrier_id,
  });
  demand(object(proof), 'INVALID_RECEIPT_PROOF');
  if (proof.verified === false) return false;
  demand(proof.verified === true && typeof proof.through_at === 'string' &&
    Number.isFinite(Date.parse(proof.through_at)) &&
    Date.parse(proof.through_at) === Date.parse(job.trial_ends_at) &&
    Number.isSafeInteger(proof.receipt_count) && (proof.receipt_count as number) >= 0 &&
    typeof proof.cancellation_exists === 'boolean', 'INVALID_RECEIPT_PROOF');
  return !proof.cancellation_exists;
}
