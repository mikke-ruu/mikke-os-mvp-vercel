import {supabase} from '@/lib/supabase/client';
import {assertAcademyWritable} from '@/lib/academy/preview';
import type {AssignmentCandidates} from './instructor-assignments';
import type {Academy2EventDetail} from './operations';
export async function replaceEventAssignment(headquartersId:string,eventId:string,revision:number,requestId:string,input:{oldRequestId:string;oldRevision:number;instructorId:string;amount:number;reason:string}):Promise<{event:Academy2EventDetail;assignments:AssignmentCandidates}>{
 assertAcademyWritable();
 const {data,error}=await supabase.rpc('academy2_replace_event_assignment',{p_headquarters_id:headquartersId,p_event_id:eventId,p_expected_revision:revision,p_request_id:requestId,p_old_request_id:input.oldRequestId,p_old_request_revision:input.oldRevision,p_new_instructor_id:input.instructorId,p_amount_yen:input.amount,p_reason:input.reason}).abortSignal(AbortSignal.timeout(30000));
 if(error)throw new Error(error.code==='PT409'?'担当または開催が更新されています。入力を残して最新の状態を確認してください。':error.code==='42501'?'交代する権限または新担当の契約・依頼受付・カード決済の登録状態を確認してください。':'担当交代を確認できませんでした。入力内容は残っています。');
 return data;
}
