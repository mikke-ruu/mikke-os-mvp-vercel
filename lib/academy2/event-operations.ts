import {supabase} from '@/lib/supabase/client';
import {assertAcademyWritable} from '@/lib/academy/preview';
import type {Academy2EventDetail} from './operations';
import type {HeadquartersApplicationDetail} from './headquarters-applications';

export type EventAttendanceStatus = 'present' | 'absent' | 'late';
export type EventAttendanceInput = {participantKey: string; status: EventAttendanceStatus; note?: string};
export type EventParticipant = {
 key: string; name: string; source: 'legacy' | 'offering';
 attendance: EventAttendanceStatus | 'unconfirmed'; attendanceNote: string; recordedAt: string | null;
 learnerPageAvailable: boolean | null; application: HeadquartersApplicationDetail | null;
 payment?: {status: string; method: string | null; amount: number; currency: string};
};
export type EventOperationsDetail = {
 event: Academy2EventDetail; revision: number | null; participants: EventParticipant[];
 unconfirmedCount: number; permissions: {finance: boolean; operate: boolean};
 allowedActions: ('record_attendance' | 'finish_event')[]; finishedAt: string | null;
};
export type EventOperationCommand = {action: 'record_attendance'; input: EventAttendanceInput} | {action: 'finish_event'; input?: never};
async function call(name: string, args: Record<string, unknown>): Promise<EventOperationsDetail> {
 const {data,error}=await supabase.rpc(name,args).abortSignal(AbortSignal.timeout(30_000));
 if(error) throw Object.assign(new Error(error.code==='PT409'?'別の変更が保存されています。入力内容を残して最新の状態を読み込み、確認してから保存してください。'
  :error.code==='42501'?'この開催または参加者を操作する権限がありません。'
  :error.message==='academy2_attendance_required'?'開催時間と全参加者の出欠を確認してください。'
  :error.message==='academy2_event_not_started'?'開始前・終了済み・中止の開催は変更できません。'
  :error.code==='22023'?'入力内容と開催の状態を確認してください。入力内容は残っています。'
  :'処理を確認できませんでした。入力内容を残して、もう一度お試しください。'),{code:error.code});
 return data as EventOperationsDetail;
}
export const getEventOperations=(headquartersId:string,eventId:string)=>call('academy2_event_operations',{p_headquarters_id:headquartersId,p_event_id:eventId});
export function commandEventOperations(headquartersId:string,eventId:string,revision:number,requestId:string,command:EventOperationCommand) {
 assertAcademyWritable();
 return call('academy2_event_operation_command',{p_headquarters_id:headquartersId,p_event_id:eventId,p_expected_revision:revision,p_request_id:requestId,p_action:command.action,p_input:command.action==='record_attendance'?command.input:{}});
}
