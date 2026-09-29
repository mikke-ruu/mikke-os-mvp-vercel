import type { OpeningScope, FeeSnapshot } from './workflow.mjs';
export type HeadquartersApplicationScope = Pick<OpeningScope, 'headquartersId' | 'applicationId' | 'learnerId' | 'salesPlanId'> & { instructorId?: string | null };
type ApplicationDetails = {
    model: 'academy2' | 'legacy';
    planTitle: string; learnerName: string; learnerEmail?: string | null;
    tuition: { status: string; amountMinor: number | null; currency: string; method: string };
    schedule?: { mode: string; startsAt: string | null; endsAt: string | null; format: string; status: string };
    kit?: { required: boolean | null; status: string };
    completion?: { attendance: string; report: string; certification: string };
};
export type InstructorApplicationProjectionInput = {
  actor: { headquartersId: string; instructorId?: string; learnerId?: string };
  application: ApplicationDetails & (
    { saleSource: 'instructor'; scope: OpeningScope }
    | { saleSource: 'headquarters'; scope: HeadquartersApplicationScope }
  );
  license?: { identity: string; status: 'paid' | 'unpaid' | 'not_required' | 'unknown' | 'refunded' | 'cancelled'; feeSnapshot?: FeeSnapshot };
  materialsRequirePaidLicense?: boolean | null;
  authorizedNextAction?: { headquartersId: string; applicationId: string; instructorId: string; key: string; allowed: boolean } | null;
  automaticMailHistory?: { headquartersId: string; applicationId: string; id: string; subject: string; body: string; sentAt: string | null; status: string }[];
};
export type ApplicationProjectionHold = { outcome: 'hold'; message: string };
export type ApplicationProgression = Record<'complete' | 'completion_report' | 'certify' | 'issue_certificate' | 'grant_rights' | 'release_materials', { state: 'allow' | 'hold' | 'blocked'; message: string | null }>;
export type ApplicationScheduleView = { mode: string; startsAt: string | null; endsAt: string | null; format: string; status: string };
export type ApplicationCompletionView = { attendance: string; report: string; certification: string };
export type ApplicationTuitionView = { status: string; amountMinor: number | null; currency: string | null; method: string };
export type LearnerApplicationView = { outcome: 'ready'; applicationId: string; planTitle: string | null; schedule: ApplicationScheduleView; tuition: ApplicationTuitionView; completion: ApplicationCompletionView; progression: ApplicationProgression };
export type InstructorApplicationView = LearnerApplicationView & {
  learnerName: string | null; contact: { email: string | null; mode: 'external_email' };
  tuition: ApplicationTuitionView & { recipient: 'headquarters' | 'instructor' };
  openingLicense: { status: string; amountMinor: number | null; currency: string | null };
  nextAction: { outcome: 'none' } | ApplicationProjectionHold | { outcome: 'action'; key: string };
  kit: { required: boolean | null; status: string };
  automaticMailHistory: { id: string | null; subject: string | null; body: string | null; sentAt: string | null; status: string; editable: false }[];
};
/** Call only after server authentication and per-application authorization. */
export function projectLearnerApplication(input: InstructorApplicationProjectionInput): LearnerApplicationView | ApplicationProjectionHold;
/** This projection never grants permissions, creates invoices, or performs mutations. */
export function projectInstructorApplication(input: InstructorApplicationProjectionInput): InstructorApplicationView | ApplicationProjectionHold;
