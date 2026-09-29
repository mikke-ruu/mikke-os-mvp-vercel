export type OpeningStripeMode='test'|'live';
export type OpeningStripeOrder={checkoutId:string;invoiceId:string;applicationId:string;headquartersId:string;actorId:string;accountId:string;amountMinor:number;currency:'jpy';mode:OpeningStripeMode;status:string;sessionId:string|null;createdAt:string;paidAt?:string|null;canPay?:boolean};
export type OpeningStripeEvent={eventId:string;eventType:string;mode:OpeningStripeMode;accountId:string;sessionId:string|null;paymentIntentId:string|null;chargeId:string|null};
export type OpeningStripeLookup=OpeningStripeEvent&{checkoutId:string|null};
export type OpeningStripeFacts={checkoutId:string;invoiceId:string;sessionId:string;accountId:string;mode:OpeningStripeMode;amountMinor:number;currency:'jpy';paymentIntentId:string|null;chargeId:string|null;refundedMinor:number;refunds:Array<{refundId:string;status:string;amountMinor:number;currency:string;createdUnix:number;reason:string|null}>;disputed:boolean;fact:'paid'|'pending'|'failed'|'expired'|'refunded'|'disputed'};
export type OpeningStripeConfig={mode:OpeningStripeMode;secretKey:string;apiVersion:string;origin:string};
export type OpeningStripeProvider={createCheckout(order:OpeningStripeOrder,actor:string):Promise<{sessionId:string;checkoutUrl:string;accountId:string}>;resumeCheckout(order:OpeningStripeOrder,session:string,actor:string):Promise<{sessionId:string;checkoutUrl:string;accountId:string}>;eventLookup(event:OpeningStripeEvent):Promise<OpeningStripeLookup|null>;readFacts(order:OpeningStripeOrder,session:string,event:OpeningStripeEvent):Promise<OpeningStripeFacts>};
export function openingStripeConfigValid(config:OpeningStripeConfig):true;
export function createOpeningStripeProvider(config:OpeningStripeConfig,fetcher?:typeof fetch):OpeningStripeProvider;
export function verifyOpeningStripeEvent(raw:Buffer,signature:string,secret:string,mode:OpeningStripeMode,now?:number):OpeningStripeEvent|null;
export function reconcileOpeningStripeEvent(event:OpeningStripeEvent|null,provider:OpeningStripeProvider,store:{find(lookup:OpeningStripeLookup):Promise<{order:OpeningStripeOrder;sessionId:string|null}|null>;attach?(order:OpeningStripeOrder,sessionId:string):Promise<void>;record(event:OpeningStripeEvent,facts:OpeningStripeFacts):Promise<{status:string}>}):Promise<{status:string}>;

export function openingStripeAttemptMayCreate(createdAt:string,now?:number):boolean;
