export type CourseStripeMode='test'|'live';
export type CourseStripeOrder={checkoutId:string;orderId:string;applicationId:string;headquartersId:string;actorId:string;accountId:string;sellerUserId:string;sellerBindingId:string;consentSnapshotId:string;consentSha256:string;feePolicyId:string;feeMinor:number;feeRateBps:number;feePolicyVersion:string;approvedChargeModel:'direct_charge';bindingVerified:true;amountMinor:number;currency:'jpy';mode:CourseStripeMode;status:string;sessionId:string|null;createdAt:string;paidAt?:string|null;canPay?:boolean};
export type CourseStripeEvent={eventId:string;eventType:string;mode:CourseStripeMode;accountId:string;sessionId:string|null;paymentIntentId:string|null;chargeId:string|null};
export type CourseStripeLookup=CourseStripeEvent&{checkoutId:string|null};
export type CourseStripeFacts={checkoutId:string;orderId:string;sessionId:string;accountId:string;mode:CourseStripeMode;amountMinor:number;currency:'jpy';paymentIntentId:string|null;chargeId:string|null;refundedMinor:number;refunds:Array<{refundId:string;status:string;amountMinor:number;currency:string;createdUnix:number;reason:string|null}>;disputed:boolean;fact:'paid'|'pending'|'failed'|'expired'|'refunded'|'disputed'};
export type CourseStripeConfig={mode:CourseStripeMode;secretKey:string;apiVersion:string;origin:string};
export type CourseStripeProvider={createCheckout(order:CourseStripeOrder,actor:string):Promise<{sessionId:string;checkoutUrl:string;accountId:string}>;resumeCheckout(order:CourseStripeOrder,session:string,actor:string):Promise<{sessionId:string;checkoutUrl:string;accountId:string}>;eventLookup(event:CourseStripeEvent):Promise<CourseStripeLookup|null>;readFacts(order:CourseStripeOrder,session:string,event:CourseStripeEvent):Promise<CourseStripeFacts>};
export function courseStripeConfigValid(config:CourseStripeConfig):true;
export function createCourseStripeProvider(config:CourseStripeConfig,fetcher?:typeof fetch):CourseStripeProvider;
export function verifyCourseStripeEvent(raw:Buffer,signature:string,secret:string,mode:CourseStripeMode,now?:number):CourseStripeEvent|null;
export function reconcileCourseStripeEvent(event:CourseStripeEvent|null,provider:CourseStripeProvider,store:{find(lookup:CourseStripeLookup):Promise<{order:CourseStripeOrder;sessionId:string|null}|null>;attach?(order:CourseStripeOrder,sessionId:string):Promise<void>;record(event:CourseStripeEvent,facts:CourseStripeFacts):Promise<{status:string}>}):Promise<{status:string}>;

export function courseStripeAttemptMayCreate(createdAt:string,now?:number):boolean;

export function courseStripeFeeMinor(amount:number,bps:number):number;
