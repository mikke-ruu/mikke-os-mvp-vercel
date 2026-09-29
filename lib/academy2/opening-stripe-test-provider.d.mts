export type OpeningTestOrder = Readonly<{ checkoutId:string; invoiceId:string; applicationId:string; headquartersId:string; actorId:string; accountId:string; amountMinor:number; currency:'jpy'; sandboxFixture:true }>;
export type OpeningTestEvent = { eventId:string; eventType:string; accountId:string; sessionId:string };
export type OpeningTestPayment = {status:'pending';sessionId:string} | { status:'paid'; sessionId:string; paymentIntentId:string; chargeId:string; accountId:string; invoiceId:string; checkoutId:string; amountMinor:number; currency:'jpy'; platformFeeAmount:null; processorFeeAmount:null };
export type OpeningTestProvider = {
 readInstructorAccount(accountId:string,userId:string):Promise<{accountId:string;userId:string;mode:'test';chargesEnabled:boolean;payoutsEnabled:boolean;detailsSubmitted:boolean}>;
 resumeCheckout(order:OpeningTestOrder,sessionId:string,actorId:string):Promise<{sessionId:string;checkoutUrl:string;accountId:string}>;
 createCheckout(order:OpeningTestOrder,actorId:string):Promise<{sessionId:string;checkoutUrl:string;accountId:string}>;
 readPayment(order:OpeningTestOrder,sessionId:string):Promise<OpeningTestPayment>;
};
export function createOpeningStripeTestProvider(config:{mode:'stripe_test_direct';sandboxEnabled:true;secretKey:string;apiVersion:string;origin:string;supabaseOrigin:string},fetcher?:typeof fetch):OpeningTestProvider;
export function verifyOpeningStripeTestEvent(raw:Buffer,signature:string,secret:string,nowSeconds?:number):OpeningTestEvent|null;
export function reconcileOpeningStripeTestEvent(event:OpeningTestEvent|null,provider:OpeningTestProvider,store:{find(accountId:string,sessionId:string):Promise<{order:OpeningTestOrder;sessionId:string}|null>;settle(event:OpeningTestEvent,payment:Extract<OpeningTestPayment,{status:'paid'}>):Promise<{status:string}>}):Promise<{status:string}>;
