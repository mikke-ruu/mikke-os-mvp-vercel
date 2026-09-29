export type HeadquartersRole = 'owner' | 'administrator' | 'learning_operator' | 'course_editor';
export type WorkflowAction = 'application_review' | 'schedule' | 'instructor_request' | 'kit_shipping' | 'attendance' | 'completion_review' | 'certification_review' | 'payment_confirmation' | 'opening_license_payment' | 'dues_payment' | 'refund' | 'teaching_fee_payment' | 'certification_confirm' | 'instructor_registration' | 'leave_request' | 'resume_request' | 'connect_configuration' | 'certification_revoke' | 'authority_revoke';
export type Hold = { outcome: 'hold'; reason: string };
export function nextApplicationAction(input: {
  actor: { role: HeadquartersRole; headquartersId: string; assignedApplicationIds?: readonly string[] };
  application: { id: string; headquartersId: string };
  candidates: readonly { key: WorkflowAction; applicationId: string; headquartersId: string; actionable: boolean }[];
  priority: readonly WorkflowAction[];
}): { outcome: 'denied' | 'none' } | Hold | { outcome: 'action'; applicationId: string; key: WorkflowAction };
export type OpeningScope = { headquartersId: string; applicationId: string; learnerId: string; openingId: string; instructorId: string; salesPlanId: string };
export function openingLicenseIdentity(scope: OpeningScope): string;
export type FeeSnapshot = { amountMinor: number; currency: string; version: string };
export function decideOpeningLicenseInvoice(input: {
  saleSource: 'headquarters' | 'instructor'; model: 'legacy' | 'academy2'; licenseRequired: boolean | null;
  scope: OpeningScope; existingInvoiceIdentity?: string | null;
  cutoverAt: string; applicationCreatedAt: string; applicationState: 'active' | 'cancelled' | 'ended';
  paymentEvent: { id: string; kind: 'tuition_payment_confirmed'; headquartersId: string; applicationId: string; learnerId: string; confirmedAt: string; previousStatus: 'unpaid' | 'paid' | 'refunded' | 'unknown'; status: 'paid' | 'unpaid' };
  connectReady: boolean | null; feeSnapshot: FeeSnapshot; scheduledAt?: string | null;
}): Hold | { outcome: 'not_applicable'; reason: string } | { outcome: 'existing'; identity: string } | {
  outcome: 'create'; identity: string; scope: OpeningScope; paymentEventId: string; feeSnapshot: FeeSnapshot; scheduledAt: string | null; chargeMode: 'instructor_initiated';
};
export function learnerOpeningGate(input: {
  scope: OpeningScope; license: { identity: string; status: 'paid' | 'unpaid' | 'not_required' | 'unknown' | 'refunded' | 'cancelled' };
  operation: 'complete' | 'completion_report' | 'certify' | 'issue_certificate' | 'grant_rights' | 'release_materials';
  materialsRequirePaidLicense?: boolean | null;
}): Hold | { outcome: 'allow' } | { outcome: 'blocked'; reason: 'opening_license_unpaid'; learnerMessage: string };
