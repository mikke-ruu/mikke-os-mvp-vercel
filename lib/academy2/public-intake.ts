import type { SalesPlanApplicationField } from './sales-plan.mjs';
export type PublicApplicationForm = { fields: SalesPlanApplicationField[]; conditionalVersion?: 1 };
export function additionalApplicationFields(form?: PublicApplicationForm) {
  return (form?.fields ?? []).filter(field => !['name', 'email', 'terms'].includes(field.id));
}
export function applicationAnswerLimit(id: string) {
  return id === 'phone' ? 50 : ['notes','preferred_date_note','shipping_address'].includes(id) ? 4000 : 1000;
}

/** Only the connected headquarters intake is projected by the v2 learner RPC.
 * Instructor and legacy applications retain their existing destination. */
export function publicIntakeHistoryHref(mode: 'headquarters' | 'instructor' | undefined, legacyHref: string) {
  return mode === 'headquarters' ? '/academy/learner-home#learner-home-learning' : legacyHref;
}


