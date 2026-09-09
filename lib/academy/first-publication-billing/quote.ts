import 'server-only';
import { demand, object } from './stripe-runtime';
import type { SetupAttempt } from './stripe-runtime';

export type PreparedQuote = {
  id:string; headquartersId:string; policyVersion:string; termsRevision:string;
  amountYen:number; instructorCount:number; issuedAt:string; expiresAt:string;
  planKey:string; planName:string; discountDescription:string; consentRevision:string;
};
const text=(value:unknown,max=200):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const date=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value));

/** Only validates server evidence. Never supplies labels, revisions or discount defaults. */
export function parsePreparedQuote(value:unknown,attempt:SetupAttempt):PreparedQuote {
  demand(object(value),'QUOTE_EVIDENCE_MISSING');
  demand(value.id===attempt.quote_id&&value.headquartersId===attempt.headquarters_id&&value.policyVersion===attempt.policy_version&&value.amountYen===attempt.amount_yen,'QUOTE_EVIDENCE_MISMATCH');
  demand(text(value.policyVersion)&&text(value.termsRevision)&&Number.isSafeInteger(value.amountYen)&&(value.amountYen as number)>0&&Number.isSafeInteger(value.instructorCount)&&(value.instructorCount as number)>=0,'QUOTE_EVIDENCE_INVALID');
  demand(date(value.issuedAt)&&date(value.expiresAt)&&Date.parse(value.expiresAt)>Date.parse(value.issuedAt),'QUOTE_EVIDENCE_INVALID');
  demand(text(value.planKey)&&text(value.planName)&&text(value.discountDescription,2000)&&text(value.consentRevision),'QUOTE_CATALOG_MISSING');
  return {id:value.id as string,headquartersId:value.headquartersId as string,policyVersion:value.policyVersion,termsRevision:value.termsRevision,
    amountYen:value.amountYen as number,instructorCount:value.instructorCount as number,issuedAt:value.issuedAt,expiresAt:value.expiresAt,
    planKey:value.planKey,planName:value.planName,discountDescription:value.discountDescription,consentRevision:value.consentRevision};
}

export function quoteFromDatabase(value:unknown,attempt:SetupAttempt):PreparedQuote {
  demand(object(value)&&value.owner_user_id===attempt.owner_user_id,'QUOTE_OWNER_MISMATCH');
  return parsePreparedQuote({id:value.id,headquartersId:value.headquarters_id,policyVersion:value.policy_version,termsRevision:value.terms_revision,
    amountYen:value.amount_yen,instructorCount:value.instructor_count,issuedAt:value.issued_at,expiresAt:value.expires_at,
    planKey:value.plan_key,planName:value.plan_name,discountDescription:value.discount_description,consentRevision:value.consent_revision},attempt);
}

export function verifyConfirmedQuote(original:PreparedQuote,saved:unknown,attempt:SetupAttempt):PreparedQuote {
  const confirmed=parsePreparedQuote(saved,attempt);
  demand((Object.keys(original) as Array<keyof PreparedQuote>).every(key=>original[key]===confirmed[key]),'QUOTE_EVIDENCE_CHANGED');
  return confirmed;
}
