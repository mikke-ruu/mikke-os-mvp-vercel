// Explicit defaults for NEW drafts only. Never merge these into persisted contracts.
export function recommendedMonthlyPolicies() {
  return { billing_policy: { anchor: 'join_date', short_month: 'last_day' }, cancellation_policy: { kind: 'before_next_charge' }, refund_policy: { kind: 'no_refund' }, unpaid_policy: { grace_days: 7 } };
}
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, allowed) => object(value) && Object.keys(value).every(key => allowed.includes(key));
export function monthlyPolicyIssues(monthly) {
  const issues = [];
  const add = (key, valid) => { if (!valid) issues.push({ path: `monthly.${key}`, code: `${key}_required`, severity: 'hold' }); };
  const b = monthly?.billing_policy;
  add('billing_policy', keys(b, ['anchor', 'day', 'short_month']) && ['join_date', 'month_start', 'day_of_month'].includes(b.anchor) && b.short_month === 'last_day' && (b.anchor === 'day_of_month' ? Number.isInteger(b.day) && b.day >= 1 && b.day <= 31 : b.day === undefined));
  const c = monthly?.cancellation_policy;
  add('cancellation_policy', keys(c, ['kind']) && ['before_next_charge', 'administrator_review'].includes(c.kind));
  const r = monthly?.refund_policy;
  add('refund_policy', keys(r, ['kind', 'explanation', 'consultation']) && ['no_refund', 'administrator_review', 'partial_refund'].includes(r.kind) && (r.explanation === undefined || typeof r.explanation === 'string') && (r.consultation === undefined || typeof r.consultation === 'string') && (r.kind !== 'partial_refund' || typeof r.explanation === 'string' && r.explanation.trim().length > 0));
  const u = monthly?.unpaid_policy;
  add('unpaid_policy', keys(u, ['grace_days']) && Number.isInteger(u.grace_days) && u.grace_days >= 0 && u.grace_days <= 2147483647);
  return issues;
}
// Calendar DATE only. This does not schedule a charge or decide the charge timezone.
export function monthlyBillingDate(billing, joinedOn, targetMonth) {
  const sample = recommendedMonthlyPolicies(); sample.billing_policy = billing;
  if (monthlyPolicyIssues(sample).length || !/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth) || !/^\d{4}-\d{2}-\d{2}$/.test(joinedOn)) throw new Error('invalid_monthly_billing_date');
  const parsed = new Date(`${joinedOn}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== joinedOn) throw new Error('invalid_monthly_billing_date');
  const [year, month] = targetMonth.split('-').map(Number);
  if (year < 1) throw new Error('invalid_monthly_billing_date');
  const last = new Date(`${targetMonth}-01T00:00:00Z`); last.setUTCMonth(last.getUTCMonth()+1); last.setUTCDate(0);
  const day = billing.anchor === 'month_start' ? 1 : billing.anchor === 'day_of_month' ? billing.day : parsed.getUTCDate();
  return `${targetMonth}-${String(Math.min(day,last.getUTCDate())).padStart(2,'0')}`;
}

