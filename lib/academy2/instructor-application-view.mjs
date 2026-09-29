import { learnerOpeningGate, openingLicenseIdentity } from './workflow.mjs';

/** Display projection of server-authorized data only. Caller-supplied actor IDs are
 * consistency checks, never authentication or authorization. Do not send the private
 * input to learners and rely on client-side hiding; project at the server boundary.
 * UI18/19/20 layout remains the baseline. LOCK 46 replaces UI18's manual license
 * application with an invoice generated after tuition confirmation; no manual request
 * action is exposed here. Mobile order remains status/next/current/application/mail/
 * schedule/tuition/license/kit/completion. No inbox or template editing is introduced.
 */
const operations = ['complete', 'completion_report', 'certify', 'issue_certificate', 'grant_rights', 'release_materials'];
const actions = new Set(['contact_learner', 'confirm_schedule', 'confirm_tuition', 'pay_opening_license', 'record_attendance', 'completion_report', 'view_completion_feedback']);
const known = (value, choices) => choices.includes(value) ? value : 'unknown';
const text = value => typeof value === 'string' ? value : null;
const amount = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const hold = () => ({ outcome: 'hold', message: '内容を確認中です。' });

function valid(input, audience) {
  const app = input?.application, actor = input?.actor;
  if (!app || app.model !== 'academy2' || !['instructor', 'headquarters'].includes(app.saleSource)) return false;
  if (app.saleSource === 'instructor') {
    try { openingLicenseIdentity(app.scope); } catch { return false; }
  } else {
    if (!['headquartersId', 'applicationId', 'learnerId', 'salesPlanId'].every(key => typeof app.scope?.[key] === 'string' && app.scope[key].trim())) return false;
    if (audience === 'instructor' && (typeof app.scope.instructorId !== 'string' || !app.scope.instructorId.trim())) return false;
  }
  return actor?.headquartersId === app.scope.headquartersId
    && (audience === 'instructor' ? actor.instructorId === app.scope.instructorId : actor.learnerId === app.scope.learnerId);
}
function gate(input, operation) {
  if (input.application.saleSource === 'headquarters') return { outcome: 'allow' };
  return learnerOpeningGate({ scope: input.application.scope, license: input.license, operation,
    materialsRequirePaidLicense: input.materialsRequirePaidLicense });
}
function scheduleView(schedule) {
  return { mode: known(schedule?.mode, ['fixed', 'arranged_after_application']), startsAt: text(schedule?.startsAt), endsAt: text(schedule?.endsAt),
    format: known(schedule?.format, ['in_person', 'online']), status: known(schedule?.status, ['unconfirmed', 'confirmed', 'completed']) };
}
function completionView(completion) {
  return { attendance: known(completion?.attendance, ['unconfirmed', 'present', 'absent']),
    report: known(completion?.report, ['not_reported', 'submitted', 'returned', 'accepted']),
    certification: known(completion?.certification, ['none', 'pending', 'certified', 'revoked']) };
}
function tuitionView(tuition) {
  return { status: known(tuition?.status, ['unpaid', 'paid', 'partially_refunded', 'refunded']),
    amountMinor: amount(tuition?.amountMinor), currency: /^[A-Z]{3}$/.test(tuition?.currency ?? '') ? tuition.currency : null,
    method: known(tuition?.method, ['bank_transfer', 'external_url', 'card', 'cash']) };
}
function progressionView(input) {
  // Only the opening-license prerequisite is represented. An "allow" result does
  // not authorize completion/certification or bypass their other server conditions.
  return Object.fromEntries(operations.map(operation => {
    const result = gate(input, operation);
    // No internal reason or invoice identifiers enter this public shape.
    return [operation, { state: result.outcome, message: result.outcome === 'allow' ? null : '受講準備中' }];
  }));
}

export function projectLearnerApplication(input) {
  if (!valid(input, 'learner')) return hold();
  const app = input.application;
  return { outcome: 'ready', applicationId: app.scope.applicationId, planTitle: text(app.planTitle),
    schedule: scheduleView(app.schedule), tuition: tuitionView(app.tuition), completion: completionView(app.completion),
    progression: progressionView(input) };
}

export function projectInstructorApplication(input) {
  if (!valid(input, 'instructor')) return hold();
  const app = input.application;
  const identity = app.saleSource === 'instructor' ? openingLicenseIdentity(app.scope) : null;
  const matched = identity !== null && input.license?.identity === identity;
  const licenseStatus = app.saleSource === 'headquarters' ? 'not_applicable'
    : matched ? known(input.license.status, ['paid', 'unpaid', 'not_required', 'unknown', 'refunded', 'cancelled']) : 'unknown';
  const quote = matched && app.saleSource === 'instructor' ? input.license.feeSnapshot : null;
  const candidate = input.authorizedNextAction;
  let nextAction = candidate == null ? { outcome: 'none' } : hold();
  if (candidate?.headquartersId === app.scope.headquartersId && candidate.applicationId === app.scope.applicationId
    && candidate.instructorId === app.scope.instructorId && candidate.allowed === true && actions.has(candidate.key)) {
    const available = candidate.key === 'completion_report' ? gate(input, 'completion_report').outcome === 'allow'
      : candidate.key === 'pay_opening_license' ? licenseStatus === 'unpaid' : true;
    if (available) nextAction = { outcome: 'action', key: candidate.key };
  }
  return { outcome: 'ready', applicationId: app.scope.applicationId, planTitle: text(app.planTitle), learnerName: text(app.learnerName),
    contact: { email: text(app.learnerEmail), mode: 'external_email' },
    tuition: { ...tuitionView(app.tuition), recipient: app.saleSource },
    openingLicense: { status: licenseStatus, amountMinor: amount(quote?.amountMinor), currency: /^[A-Z]{3}$/.test(quote?.currency ?? '') ? quote.currency : null },
    schedule: scheduleView(app.schedule), completion: completionView(app.completion), progression: progressionView(input), nextAction,
    kit: { required: typeof app.kit?.required === 'boolean' ? app.kit.required : null,
      status: known(app.kit?.status, ['not_required', 'preparing', 'shipped', 'delivered']) },
    // Only records already scoped/authorized for this application are projected.
    automaticMailHistory: (input.automaticMailHistory ?? []).filter(mail => mail.headquartersId === app.scope.headquartersId && mail.applicationId === app.scope.applicationId).map(mail => ({
      id: text(mail.id), subject: text(mail.subject), body: text(mail.body), sentAt: text(mail.sentAt),
      status: known(mail.status, ['scheduled', 'unsent', 'sent', 'resent', 'failed']), editable: false,
    })),
  };
}
