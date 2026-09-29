export type MonthlyPolicies = {
 billing_policy: { anchor: 'join_date' | 'month_start'; short_month: 'last_day' } | { anchor: 'day_of_month'; day: number; short_month: 'last_day' };
 cancellation_policy: { kind: 'before_next_charge' | 'administrator_review' };
 refund_policy: { kind: 'no_refund' | 'administrator_review'; explanation?: string; consultation?: string } | { kind: 'partial_refund'; explanation: string; consultation?: string };
 unpaid_policy: { grace_days: number };
};
export function recommendedMonthlyPolicies(): MonthlyPolicies;
export function monthlyPolicyIssues(monthly: unknown): { path: string; code: string; severity: 'hold' }[];
export function monthlyBillingDate(billing: MonthlyPolicies['billing_policy'], joinedOn: string, targetMonth: string): string;

