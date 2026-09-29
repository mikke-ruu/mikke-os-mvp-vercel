import type {IntakeField,ApplicationContext} from './application-conditions.mjs';
import type {AcademyPageBlock} from '@/types/database';
export type MonthlyReviewQuote={id:string;mode:'local_review';published:false;title:string;price:number;currency:'JPY';terms:{version:string;body:string};monthly:unknown;exitDocument:{version:string;body:string};fields:(IntakeField&{_context?:ApplicationContext})[];existingEnrollmentId:string|null;nextDueOn:string};
export type MonthlyReviewEnrollment={id:string;sourceId:string;invoiceId:string;provider:'local_simulator';title:string;price:number;currency:'JPY';status:'unpaid'|'paid'|'first_payment_expired'|'renewal_not_connected';joinedOn:string;paidOn:string|null;nextDueOn:string;materialsAvailable:boolean;canPay:boolean;renewalConnected:false};
export type MonthlyReviewMaterials={enrollmentId:string;planName:string;courses:{courseId:string;courseName:string;month:string;materialRevision:number;blocks:AcademyPageBlock[]}[]};
