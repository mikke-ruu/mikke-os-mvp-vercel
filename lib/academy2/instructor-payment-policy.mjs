const demand=(value,code)=>{if(!value)throw new Error(code);};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);

/** Read-only verification for an instructor receiving HQ teaching fees.
 * Opening-license payers do not need their own Connected Account.
 * Binding must come from the private server ledger, never browser metadata.
 */
export function createInstructorAccountReader({mode,secretKey,apiVersion},fetcher=fetch,now=Date.now){
 demand(['test','live'].includes(mode)&&typeof secretKey==='string'&&secretKey.startsWith(`sk_${mode}_`),'INSTRUCTOR_PROVIDER_MODE_MISMATCH');
 demand(typeof apiVersion==='string'&&/^\d{4}-\d{2}-\d{2}(\.[a-z]+)?$/.test(apiVersion),'INSTRUCTOR_API_VERSION_REQUIRED');
 return async binding=>{
  demand(binding&&uuid(binding.userId)&&/^acct_[A-Za-z0-9]+$/.test(binding.accountId)&&binding.mode===mode&&typeof binding.bindingReference==='string'&&binding.bindingReference.length>0,'INSTRUCTOR_BINDING_REQUIRED');
  const response=await fetcher(`https://api.stripe.com/v1/accounts/${binding.accountId}`,{method:'GET',headers:{Authorization:`Bearer ${secretKey}`,'Stripe-Version':apiVersion},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
  demand(response.ok,'INSTRUCTOR_PROVIDER_READ_FAILED');
  const account=await response.json();
  demand(account?.object==='account'&&account.id===binding.accountId&&account.metadata?.academy2_instructor_user_id===binding.userId,'INSTRUCTOR_IDENTITY_MISMATCH');
  // Account objects may omit livemode. The mode-bound key/request supplies mode;
  // if returned, the value must agree. Never infer mode from account ID.
  demand(!Object.hasOwn(account,'livemode')||account.livemode===(mode==='live'),'INSTRUCTOR_PROVIDER_MODE_MISMATCH');
  const verifiedAt=now();demand(Number.isSafeInteger(verifiedAt),'INSTRUCTOR_CLOCK_INVALID');
  return Object.freeze({userId:binding.userId,accountId:binding.accountId,mode,
   chargesEnabled:account.charges_enabled===true,payoutsEnabled:account.payouts_enabled===true,
   detailsSubmitted:account.details_submitted===true,transfersActive:account.capabilities?.transfers==='active',
   disabled:!!account.requirements?.disabled_reason,verifiedAt,validUntil:verifiedAt+300000});
 };
}

/** HQ connected balance is decided; Account Debits suitability/consent is not. */
export function instructorFeeExecutionGate(){
 return Object.freeze({allowed:false,reason:'INSTRUCTOR_FEE_PROVIDER_APPROVAL_REQUIRED'});
}

/** Provider/legal evidence is server-side evidence, never browser checkboxes.
 * This produces no charge/transfer request and never grants execution rights.
 */
export function instructorFeeFundingPreflight(input){
 const reasons=[];
 if(!input?.receiverConnected)reasons.push('RECEIVER_CONNECT_REQUIRED');
 if(!input?.hqBalanceAccountVerified)reasons.push('HEADQUARTERS_BALANCE_ACCOUNT_UNVERIFIED');
 if(input?.negativeBalanceLiability!=='platform')reasons.push('ACCOUNT_DEBIT_ACCOUNT_INELIGIBLE');
 if(!input?.sameRegion||!input?.defaultCurrencyMatches)reasons.push('ACCOUNT_DEBIT_REGION_CURRENCY_UNVERIFIED');
 if(!input?.bindingDebitConsentReference)reasons.push('ACCOUNT_DEBIT_CONSENT_REQUIRED');
 if(!input?.additionalFeeApprovalReference)reasons.push('ACCOUNT_DEBIT_ADDITIONAL_FEE_APPROVAL_REQUIRED');
 if(!Number.isSafeInteger(input?.acceptedFeeYen)||input.acceptedFeeYen<0)reasons.push('ACCEPTED_FEE_INVALID');
 if(!Number.isSafeInteger(input?.stripeFeeYen)||input.stripeFeeYen<0)reasons.push('STRIPE_FEE_UNVERIFIED');
 if(!Number.isSafeInteger(input?.availableYen)||input.availableYen<0||!Number.isSafeInteger(input?.acceptedFeeYen+input?.stripeFeeYen)||input.availableYen<input.acceptedFeeYen+input.stripeFeeYen)reasons.push('HEADQUARTERS_BALANCE_UNVERIFIED_OR_INSUFFICIENT');
 return Object.freeze({fundingSource:'headquarters_stripe_balance',receiverAmountYen:input?.acceptedFeeYen??null,feeBearer:'headquarters',readyForImplementationReview:reasons.length===0,executionAllowed:false,reasons});
}
