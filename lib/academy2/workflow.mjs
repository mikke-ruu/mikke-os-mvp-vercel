/** Pure LOCK workflow decisions. Callers must authenticate and scope database reads;
 * these functions neither query data nor charge money nor replace server authorization. */
const daily = new Set(['application_review', 'schedule', 'instructor_request', 'kit_shipping', 'attendance', 'completion_review', 'certification_review']);
const finance = new Set(['payment_confirmation', 'opening_license_payment', 'dues_payment', 'refund', 'teaching_fee_payment']);
const administration = new Set(['certification_confirm', 'instructor_registration', 'leave_request', 'resume_request']);
const supreme = new Set(['connect_configuration', 'certification_revoke', 'authority_revoke']);
const roles = new Set(['owner', 'administrator', 'learning_operator', 'course_editor']);
const id = value => typeof value === 'string' && value.trim().length > 0;
const instant = value => {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second, , offsetHour = '0', offsetMinute = '0'] = match;
  return +month >= 1 && +month <= 12 && +day >= 1 && +day <= new Date(Date.UTC(+year, +month, 0)).getUTCDate()
    && +hour < 24 && +minute < 60 && +second < 60 && +offsetHour <= 14 && +offsetMinute < 60
    && (+offsetHour < 14 || +offsetMinute === 0) && Number.isFinite(Date.parse(value));
};

/** Returns only a whitelisted action reference, never arbitrary candidate labels or amounts.
 * Priority comes from the calling workflow, not an undocumented global business order. */
export function nextApplicationAction({ actor, application, candidates, priority }) {
  if (!actor || !roles.has(actor.role) || !application || !id(application.id) || actor.headquartersId !== application.headquartersId || !id(actor.headquartersId)) return { outcome: 'denied' };
  if (actor.role === 'course_editor') return { outcome: 'none' };
  if (!Array.isArray(candidates) || !Array.isArray(priority)) return { outcome: 'hold', reason: 'priority_or_candidates_required' };
  if (actor.role === 'learning_operator' && (!Array.isArray(actor.assignedApplicationIds) || !actor.assignedApplicationIds.includes(application.id))) return { outcome: 'denied' };
  const permitted = key => actor.role === 'owner' ? supreme.has(key) : actor.role === 'administrator' ? daily.has(key) || finance.has(key) || administration.has(key) : daily.has(key);
  const actionable = candidates.filter(candidate => candidate?.applicationId === application.id && candidate.headquartersId === application.headquartersId && candidate.actionable === true && permitted(candidate.key));
  if (!actionable.length) return { outcome: 'none' };
  for (const key of priority) {
    if (actionable.some(candidate => candidate.key === key)) return { outcome: 'action', applicationId: application.id, key };
  }
  return { outcome: 'hold', reason: 'action_priority_required' };
}

/** One immutable invoice identity per application, learner and opening, including tenant.
 * Persist with a UNIQUE constraint in a transaction; a pure decision cannot guarantee
 * concurrent-write idempotency. Event IDs intentionally do not enter the identity.
 * All scope IDs must come from the immutable original enrollment. openingId is a
 * persisted enrollment/opening reference, never a random per-request ID or date. */
export function openingLicenseIdentity(scope) {
  const parts = ['headquartersId', 'applicationId', 'learnerId', 'openingId', 'instructorId', 'salesPlanId'].map(key => scope?.[key]);
  if (!parts.every(id)) throw new TypeError('Opening license scope is incomplete');
  return `academy2:opening-license:${parts.map(encodeURIComponent).join(':')}`;
}

export function decideOpeningLicenseInvoice(input) {
  const hold = reason => ({ outcome: 'hold', reason });
  if (!input || !['headquarters', 'instructor'].includes(input.saleSource)) return hold('sale_source_unknown');
  if (input.saleSource === 'headquarters') return { outcome: 'not_applicable', reason: 'headquarters_sale' };
  if (input.model === 'legacy') return { outcome: 'not_applicable', reason: 'legacy_preserved' };
  if (input.model !== 'academy2') return hold('model_unknown');
  if (input.licenseRequired === false) return { outcome: 'not_applicable', reason: 'license_not_required' };
  if (input.licenseRequired !== true) return hold('license_requirement_unknown');
  let identity;
  try { identity = openingLicenseIdentity(input.scope); } catch { return hold('scope_incomplete'); }
  if (input.existingInvoiceIdentity != null) return input.existingInvoiceIdentity === identity
    ? { outcome: 'existing', identity } : hold('existing_invoice_scope_mismatch');
  const event = input.paymentEvent;
  if (!instant(input.cutoverAt) || !instant(input.applicationCreatedAt) || !event || !instant(event.confirmedAt)) return hold('verified_timing_required');
  if (Date.parse(input.applicationCreatedAt) < Date.parse(input.cutoverAt) || Date.parse(event.confirmedAt) < Date.parse(input.cutoverAt)) return { outcome: 'not_applicable', reason: 'pre_cutover_preserved' };
  if (!id(event.id) || event.kind !== 'tuition_payment_confirmed' || event.headquartersId !== input.scope.headquartersId || event.applicationId !== input.scope.applicationId || event.learnerId !== input.scope.learnerId) return hold('payment_event_scope_mismatch');
  if (Date.parse(event.confirmedAt) < Date.parse(input.applicationCreatedAt)) return hold('payment_before_application');
  if (event.previousStatus !== 'unpaid' || event.status !== 'paid') return hold('fresh_payment_transition_required');
  if (input.applicationState !== 'active') return hold('application_not_active');
  if (input.connectReady !== true) return hold('connect_readiness_required');
  const quote = input.feeSnapshot;
  if (!quote || !Number.isSafeInteger(quote.amountMinor) || quote.amountMinor < 0 || !/^[A-Z]{3}$/.test(quote.currency ?? '') || !id(quote.version)) return hold('fee_snapshot_required');
  if (quote.amountMinor === 0) return hold('zero_fee_policy_unresolved');
  // No date requirement: consultation sales may have no fixed date at invoicing.
  const { headquartersId, applicationId, learnerId, openingId, instructorId, salesPlanId } = input.scope;
  return { outcome: 'create', identity, scope: { headquartersId, applicationId, learnerId, openingId, instructorId, salesPlanId }, paymentEventId: event.id,
    feeSnapshot: { amountMinor: quote.amountMinor, currency: quote.currency, version: quote.version },
    scheduledAt: input.scheduledAt ?? null, chargeMode: 'instructor_initiated' };
}

const gated = new Set(['complete', 'completion_report', 'certify', 'issue_certificate', 'grant_rights', 'release_materials']);
/** Evaluate each learner independently. An event ID must never be passed as a learner scope. */
export function learnerOpeningGate({ scope, license, operation, materialsRequirePaidLicense }) {
  if (!gated.has(operation)) return { outcome: 'hold', reason: 'unknown_operation' };
  let identity;
  try { identity = openingLicenseIdentity(scope); } catch { return { outcome: 'hold', reason: 'scope_incomplete' }; }
  if (!license || license.identity !== identity) return { outcome: 'hold', reason: 'license_scope_unknown' };
  if (license.status === 'not_required' || license.status === 'paid') return { outcome: 'allow' };
  if (operation === 'release_materials' && materialsRequirePaidLicense === false) return { outcome: 'allow' };
  if (operation === 'release_materials' && materialsRequirePaidLicense !== true) return { outcome: 'hold', reason: 'material_policy_unknown' };
  if (license.status === 'unpaid') return { outcome: 'blocked', reason: 'opening_license_unpaid', learnerMessage: '受講準備中' };
  return { outcome: 'hold', reason: 'license_status_unresolved' };
}
