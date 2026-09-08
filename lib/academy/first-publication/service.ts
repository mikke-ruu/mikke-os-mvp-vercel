/** Server-only orchestration. No browser clock, provider call, or legacy-state write.
 * A production repository MUST commit course/state/outbox/owner-ledger atomically.
 * Do not implement transaction() using separate PostgREST requests.
 */
export const TRIAL_MS = 168 * 60 * 60 * 1000;
export type Policy = {
  version: string;
  approvalId: string;
  termsRevision: string;
  quoteTtlMs: number;
  initialPrice: "fixed_at_publication";
  cancellation: "inclusive_deadline";
  eligibility: "no_previous_trial_or_contract";
};
export type Quote = {
  id: string; headquartersId: string; ownerUserId: string;
  amountYen: number; instructorCount: number; termsRevision: string;
  policyVersion: string; issuedAt: number; expiresAt: number;
};
export type Context = {
  headquartersId: string; ownerUserId: string; actorUserId: string;
  authenticated: boolean; anonymous: boolean; canContract: boolean;
  legacyAccess: boolean; previousTrialUsed: boolean; priorPublications: boolean;
  currentAmountYen: number; currentInstructorCount: number;
};
export type RecordState = {
  headquartersId: string; ownerUserId: string; policyVersion: string; approvalId: string;
  termsRevision: string; quoteId: string; amountYen: number; instructorCount: number;
  consentAt: number; paymentPreparationId: string;
  firstPublishedAt: number | null; trialEndsAt: number | null;
  cancellationAcceptedAt: number | null;
  phase: "prepared" | "sync_pending" | "trialing" | "cancelled" | "attention";
};
export type Outbox = {
  key: string; headquartersId: string;
  kind: "synchronize_trial" | "cancel_conversion";
  firstPublishedAt: number | null; trialEndsAt: number | null;
};
export interface Transaction {
  /** DB/server time after acquiring the owner + HQ locks. */
  now(): number;
  /** Trusted request/statement receipt time, captured before waiting for owner/HQ locks. */
  receivedAt(): number;
  context(): Promise<Context>;
  state(): Promise<RecordState | null>;
  quote(id: string): Promise<Quote | null>;
  /** Trusted provider verification saved server-side, never supplied by the browser. */
  paymentPreparation(id: string): Promise<{
    id: string; headquartersId: string; ownerUserId: string;
    quoteId: string; verified: boolean; revoked: boolean;
  } | null>;
  course(id: string): Promise<{ headquartersId: string; published: boolean } | null>;
  save(state: RecordState): Promise<void>;
  publishCourse(id: string, published: boolean): Promise<void>;
  /** Immutable owner-wide marker. A second HQ must not get another trial. */
  claimOwnerTrial(headquartersId: string): Promise<void>;
  enqueue(event: Outbox): Promise<void>;
}
export interface Repository {
  /** Verify actor from a server session. Serialize by owner then HQ; roll back on error. */
  transaction<T>(headquartersId: string, actorUserId: string, run: (tx: Transaction) => Promise<T>): Promise<T>;
}
export class FirstPublicationError extends Error {
  constructor(public readonly code: string) { super(code); }
}
function check(value: unknown, code: string): asserts value {
  if (!value) throw new FirstPublicationError(code);
}
function policyIsApproved(policy: Policy | null): asserts policy is Policy {
  check(policy, "policy_not_approved");
  check(policy.approvalId?.trim() && policy.version?.trim() && policy.termsRevision?.trim(), "policy_not_approved");
  check(Number.isSafeInteger(policy.quoteTtlMs) && policy.quoteTtlMs > 0 &&
    policy.initialPrice === "fixed_at_publication" && policy.cancellation === "inclusive_deadline" &&
    policy.eligibility === "no_previous_trial_or_contract", "invalid_policy");
}
async function authorize(tx: Transaction, headquartersId: string, actorUserId: string) {
  const ctx = await tx.context();
  check(ctx.authenticated && !ctx.anonymous && ctx.actorUserId === actorUserId &&
    ctx.headquartersId === headquartersId && ctx.ownerUserId === actorUserId && ctx.canContract, "forbidden");
  return ctx;
}
function sameScheme(state: RecordState, ctx: Context, policy: Policy) {
  check(state.headquartersId === ctx.headquartersId && state.ownerUserId === ctx.ownerUserId, "scope_mismatch");
  check(state.policyVersion === policy.version && state.approvalId === policy.approvalId &&
    state.termsRevision === policy.termsRevision, "scheme_mismatch");
}
function eligible(ctx: Context) {
  check(!ctx.legacyAccess && !ctx.previousTrialUsed && !ctx.priorPublications, "not_eligible_for_new_scheme");
}
async function validQuote(tx: Transaction, id: string, ctx: Context, policy: Policy) {
  const q = await tx.quote(id);
  const now = tx.now();
  check(Number.isSafeInteger(now) && now > 0, "invalid_server_time");
  check(q && q.headquartersId === ctx.headquartersId && q.ownerUserId === ctx.ownerUserId, "quote_not_found");
  check(q.policyVersion === policy.version && q.termsRevision === policy.termsRevision, "quote_revision_changed");
  check(Number.isSafeInteger(q.issuedAt) && Number.isSafeInteger(q.expiresAt) &&
    q.issuedAt <= now && now < q.expiresAt && q.expiresAt <= q.issuedAt + policy.quoteTtlMs, "quote_expired");
  check(Number.isSafeInteger(q.amountYen) && q.amountYen > 0 && Number.isSafeInteger(q.instructorCount) && q.instructorCount >= 0,
    "invalid_quote");
  check(q.amountYen === ctx.currentAmountYen && q.instructorCount === ctx.currentInstructorCount, "requote_required");
  return q;
}
export function createFirstPublicationService(repo: Repository, policy: Policy | null) {
  return {
    async prepare(hq: string, actor: string, input: { quoteId: string; paymentPreparationId: string; acceptedTermsRevision: string; acceptedAmountYen: number; consent: boolean }) {
      policyIsApproved(policy);
      return repo.transaction(hq, actor, async tx => {
        const ctx = await authorize(tx, hq, actor);
        const prev = await tx.state();
        if (prev) { sameScheme(prev, ctx, policy); check(prev.firstPublishedAt === null && prev.phase === "prepared", "already_started_or_cancelled"); }
        eligible(ctx);
        const q = await validQuote(tx, input.quoteId, ctx, policy);
        check(input.consent === true && input.acceptedTermsRevision === q.termsRevision && input.acceptedAmountYen === q.amountYen, "explicit_consent_required");
        const proof = await tx.paymentPreparation(input.paymentPreparationId);
        check(proof?.verified && !proof.revoked && proof.headquartersId === hq && proof.ownerUserId === actor && proof.quoteId === q.id,
          "payment_preparation_unverified");
        const next: RecordState = {
          headquartersId: hq, ownerUserId: actor, policyVersion: policy.version, approvalId: policy.approvalId,
          termsRevision: q.termsRevision, quoteId: q.id, amountYen: q.amountYen, instructorCount: q.instructorCount,
          consentAt: tx.now(), paymentPreparationId: proof.id, firstPublishedAt: null, trialEndsAt: null,
          cancellationAcceptedAt: null, phase: "prepared",
        };
        await tx.save(next);
        return next;
      });
    },
    async publish(hq: string, actor: string, input: { courseId: string; quoteId: string; confirmed: boolean }) {
      policyIsApproved(policy);
      return repo.transaction(hq, actor, async tx => {
        const ctx = await authorize(tx, hq, actor);
        const state = await tx.state();
        check(state, "explicit_enrollment_required");
        sameScheme(state, ctx, policy);
        check(input.confirmed === true, "publication_confirmation_required");
        const course = await tx.course(input.courseId);
        check(course?.headquartersId === hq, "course_not_found");
        check(state.phase !== "cancelled" && state.phase !== "attention", "publication_blocked");
        if (state.firstPublishedAt !== null) {
          check(state.trialEndsAt !== null && tx.now() < state.trialEndsAt, "trial_ended");
          await tx.publishCourse(input.courseId, true);
          return state;
        }
        eligible(ctx);
        check(state.phase === "prepared" && !course.published && input.quoteId === state.quoteId, "confirmation_changed");
        await validQuote(tx, state.quoteId, ctx, policy);
        const proof = await tx.paymentPreparation(state.paymentPreparationId);
        check(proof?.verified && !proof.revoked && proof.headquartersId === hq && proof.ownerUserId === actor && proof.quoteId === state.quoteId,
          "payment_preparation_unverified");
        const started = tx.now();
        check(Number.isSafeInteger(started + TRIAL_MS), "invalid_server_time");
        const next: RecordState = { ...state, phase: "sync_pending", firstPublishedAt: started, trialEndsAt: started + TRIAL_MS };
        await tx.claimOwnerTrial(hq);
        await tx.save(next);
        await tx.publishCourse(input.courseId, true);
        await tx.enqueue({ key: `academy-first-publication:${hq}`, headquartersId: hq,
          kind: "synchronize_trial", firstPublishedAt: next.firstPublishedAt, trialEndsAt: next.trialEndsAt });
        return next;
      });
    },
    async unpublish(hq: string, actor: string, courseId: string) {
      // Disabling new enrollments must not prevent an owner from taking a page down.
      return repo.transaction(hq, actor, async tx => {
        const ctx = await authorize(tx, hq, actor);
        const state = await tx.state();
        check(state && state.headquartersId === ctx.headquartersId && state.ownerUserId === actor, "enrollment_not_found");
        const course = await tx.course(courseId);
        check(course?.headquartersId === hq, "course_not_found");
        await tx.publishCourse(courseId, false);
        return state; // Do not reset firstPublishedAt or cancel the contract.
      });
    },
    async cancelConversion(hq: string, actor: string) {
      // Cancellation remains available when rollout is paused or its policy changes.
      return repo.transaction(hq, actor, async tx => {
        await authorize(tx, hq, actor);
        const state = await tx.state();
        check(state && state.headquartersId === hq && state.ownerUserId === actor, "enrollment_not_found");
        if (state.cancellationAcceptedAt !== null) return state;
        const received = tx.receivedAt();
        check(Number.isSafeInteger(received) && received > 0 && received <= tx.now(), "invalid_server_receipt_time");
        check(state.trialEndsAt === null || received <= state.trialEndsAt, "paid_cancellation_required");
        const next: RecordState = { ...state, phase: "cancelled", cancellationAcceptedAt: received };
        await tx.save(next);
        await tx.enqueue({ key: `academy-first-publication-cancel:${hq}`, headquartersId: hq,
          kind: "cancel_conversion", firstPublishedAt: next.firstPublishedAt, trialEndsAt: next.trialEndsAt });
        return next;
      });
    },
  };
}
