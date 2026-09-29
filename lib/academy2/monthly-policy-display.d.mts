export const monthlyPolicyReasonLabels:Record<string,string>;
export function monthlyPolicyMessages(monthly:unknown):{path:string;code:string;message:string}[];
export function monthlyPolicySummary(monthly:unknown):{key:string;label:string;value:string;notes:string[]}[];

export function nextMonthlyRefundPolicy(kind:string):import('./monthly-policy.mjs').MonthlyPolicies['refund_policy']|undefined;

export const monthlyInitialPaymentText:string;
