import { supabase } from '@/lib/supabase/client';

export type ActivityStatus = 'active' | 'payment_pending' | 'leave' | 'suspended';
export type ActivityRequestInput = {kind:'leave'|'resume';startsOn:string|null;endsOn:string|null;reason:string};
export type ActivityView = {id:string;status:ActivityStatus;leaveAllowed:boolean;transitionReviewRequired?:boolean;requests:Array<{id:string;kind:'leave'|'resume';status:'pending'|'approved'|'declined';startsOn:string|null;endsOn:string|null;reason:string;response:string|null}>};

export function activityError(error: unknown): string {
 const e=error as {code?:string;message?:string};
 if(e?.code==='42501') return 'この活動情報を確認する権限がありません。';
 if(e?.code==='23505') return '確認中または回答済みの申請があります。最新の状態を確認してください。';
 if(e?.code==='22023') return '申請できる状態と、期間・理由の入力を確認してください。';
 if(e?.code==='PGRST202'||e?.code==='42883') return '活動・契約の設定を準備しています。';
 return '保存できませんでした。入力内容を残しています。時間をおいてもう一度お試しください。';
}
export async function loadInstructorActivity(activityId:string):Promise<ActivityView>{
 const {data,error}=await supabase.rpc('academy2_instructor_activity',{p_activity_id:activityId});
 if(error)throw new Error(activityError(error));return data as ActivityView;
}
export async function requestInstructorActivity(activityId:string,input:ActivityRequestInput):Promise<ActivityView>{
 const {data,error}=await supabase.rpc('academy2_request_activity',{p_activity_id:activityId,p_kind:input.kind,p_starts_on:input.startsOn,p_ends_on:input.endsOn,p_reason:input.reason});
 if(error)throw new Error(activityError(error));return data as ActivityView;
}
export async function reviewInstructorActivity(requestId:string,status:'approved'|'declined',response:string):Promise<ActivityView>{
 const {data,error}=await supabase.rpc('academy2_review_activity',{p_request_id:requestId,p_status:status,p_response:response});
 if(error)throw new Error(activityError(error));return data as ActivityView;
}
