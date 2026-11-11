import type {ApplicationSchedule,IndividualSchedule} from './application-schedule';
import { supabase } from '@/lib/supabase/client';
import { assertAcademyWritable } from '@/lib/academy/preview';
import type { Academy2Operation } from './operations';
import type { InstructorApplicationDetailData } from './instructor-operations';

export type HeadquartersApplicationSummary = {
  source?: 'academy2' | 'legacy_course' | 'legacy_plan' | 'guest';
  applicationId: string; headquartersId: string; saleChannel: 'headquarters' | 'instructor';
  applicantName: string; planTitle: string; appliedAt: string; statusLabel: string;
  nextAction: string | null; revision: number; completed?: boolean;
  thumbnailUrl?:string|null; participantKey?:string;
  fulfillment?:{required:boolean;shipped:boolean};
  tuition?: { amount: number; currency: string; status: string; method: string };
  schedule?:ApplicationSchedule|null; kitStatus: string | null; completedAt: string | null; certifiedAt: string | null;
};
export type HeadquartersApplicationDetail = {
  guest?: import('@/components/academy2/GuestApplicationDetail').GuestDetail;
  workspace?: {history:ApplicationHistory[];canWriteNote:boolean;canUndoPayment:boolean;canEditShipping?:boolean;canUndoShipping?:boolean;canUndoCompletion?:boolean;eventFacts?:{materials:string;assignee:string}};
  summary: HeadquartersApplicationSummary;
  /** Historical originals are projected by the HQ-scoped RPC, never reconstructed from the current form. */
  legacy?: {
    source: 'legacy_course' | 'legacy_plan';
    completed?: boolean;
    contactEmail: string | null; phone: string | null;
    answers: { label: string; value: string | null }[];
    consent: { version: string | null; consentedAt: string | null } | null;
    allowedActions: ('confirm_payment' | 'confirm_completion')[];
    reference: { courseId?: string | null; salesPlanId?: string | null; eventId?: string | null };
  } | null;
  headquarters: (Academy2Operation & {
    location?: import('./operations').EventLocation|null;
    contactEmail: string | null; allowedActions: string[]; individualSchedule?:IndividualSchedule|null;scheduleWritable?:boolean;
    event: { id: string; revision: number; startsAt: string | null; endsAt: string | null; format: 'in_person' | 'online'; venueName: string | null; meetingUrl: string | null } | null;
    shipping: { required: boolean; recipient?: 'learner' | 'instructor'; eventId?: string | null; status: string; address: string | null; shippedAt: string | null; shippedDate?:string; carrier?:string; trackingNumber: string | null };
  }) | null;
  instructor: InstructorApplicationDetailData | null;
};
export type HeadquartersApplicationAction = 'confirm_payment' | 'confirm_completion' | 'confirm_certification' | 'set_shipping_destination' | 'record_shipping';
async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args).abortSignal(AbortSignal.timeout(30_000));
  if (error) throw Object.assign(new Error(error.code === '42501' ? 'この申込を操作する権限がありません。'
    : error.code === 'PT409' ? '別の変更が保存されています。入力内容を残して、最新の状態を読み込んでください。'
    : error.code === '22023' ? '現在の状態と入力内容を確認してください。必要な支払い・日程・修了確認が完了していない場合は先へ進めません。'
    : '処理を確認できませんでした。入力内容を残して、もう一度お試しください。'), { code: error.code });
  return data as T;
}
async function guestApplications(hq:string,id?:string):Promise<HeadquartersApplicationDetail[]>{
 const r=await supabase.rpc('academy2_guest_hq',{p_hq:hq,p_id:id??null});
 if(r.error){if(r.error.code==='PGRST202')return [];throw new Error('ゲスト申込を読み込めませんでした。');}return r.data??[];
}
export const listHeadquartersApplications = async (headquartersId:string):Promise<HeadquartersApplicationSummary[]>=>{
 const [normal,guest]=await Promise.all([call<HeadquartersApplicationSummary[]>('academy2_hq_application_cards',{p_headquarters_id:headquartersId}),guestApplications(headquartersId)]);
 return [...normal,...guest.map(v=>v.summary)];
};
export const getHeadquartersApplication = async (headquartersId:string,applicationId:string):Promise<HeadquartersApplicationDetail>=>{
 const guest=await guestApplications(headquartersId,applicationId);if(guest.length)return guest[0];
 return call('academy2_hq_application_overview',{p_headquarters_id:headquartersId,p_application_id:applicationId});
};
export type ApplicationHistory={id:string;action:string;note?:string|null;at:string;actor:string};
export type AcademyParticipant={key:string;name:string;contactEmail?:string|null;lastAppliedAt:string;completedCount:number;applications:HeadquartersApplicationSummary[];notes?:ApplicationHistory[];canWriteNote?:boolean};
export const listParticipants=async(hq:string):Promise<AcademyParticipant[]>=>{
 const [normal,guest]=await Promise.all([call<AcademyParticipant[]>('academy2_hq_participants',{p_headquarters_id:hq}),guestApplications(hq)]);
 return [...normal,...guest.map(guestParticipant)];
};
function guestParticipant(v:HeadquartersApplicationDetail):AcademyParticipant{return {key:'unlinked:'+v.summary.applicationId,name:v.summary.applicantName,contactEmail:v.guest?.email,lastAppliedAt:v.summary.appliedAt,completedCount:v.summary.completedAt?1:0,applications:[v.summary],notes:[],canWriteNote:false};}
export const getParticipant=async(hq:string,key:string):Promise<AcademyParticipant>=>{
 if(/^unlinked:[a-f0-9-]{36}$/i.test(key)){const guest=await guestApplications(hq,key.slice(9));if(guest.length)return guestParticipant(guest[0]);}
 return call('academy2_hq_participants',{p_headquarters_id:hq,p_participant:key});
};
export function saveInternalNote(hq:string,subject:string,request:string,body:string):Promise<ApplicationHistory[]>{assertAcademyWritable();return call('academy2_hq_save_note',{p_headquarters_id:hq,p_subject:subject,p_request_id:request,p_body:body});}
export function undoHeadquartersPayment(hq:string,id:string,revision:number,request:string):Promise<HeadquartersApplicationDetail>{assertAcademyWritable();return call('academy2_hq_undo_payment',{p_headquarters_id:hq,p_application_id:id,p_expected_revision:revision,p_request_id:request}).then(()=>getHeadquartersApplication(hq,id));}
export type ApplicationCorrection='edit_shipping'|'undo_shipping'|'undo_completion';
export function correctApplicationRecord(hq:string,id:string,revision:number,request:string,action:ApplicationCorrection,input:Record<string,string>={}):Promise<HeadquartersApplicationDetail>{assertAcademyWritable();return call('academy2_hq_correct_fulfillment',{p_headquarters_id:hq,p_application_id:id,p_expected_revision:revision,p_request_id:request,p_action:action,p_input:input});}
export function commandHeadquartersApplication(headquartersId: string, applicationId: string, expectedRevision: number, requestId: string, action: HeadquartersApplicationAction, input: Record<string, unknown> = {}): Promise<HeadquartersApplicationDetail> {
  assertAcademyWritable();
  return call('academy2_hq_application_command', { p_headquarters_id: headquartersId, p_application_id: applicationId, p_expected_revision: expectedRevision, p_request_id: requestId, p_action: action, p_input: input });
}

export function recordHeadquartersShipment(headquartersId:string,applicationId:string,expectedRevision:number,requestId:string,input:{date:string;carrier:string;trackingNumber:string}):Promise<HeadquartersApplicationDetail>{
 assertAcademyWritable();
 return call('academy2_hq_record_shipment',{p_headquarters_id:headquartersId,p_application_id:applicationId,p_expected_revision:expectedRevision,p_request_id:requestId,p_shipped_date:input.date||null,p_carrier:input.carrier,p_tracking_number:input.trackingNumber});
}
