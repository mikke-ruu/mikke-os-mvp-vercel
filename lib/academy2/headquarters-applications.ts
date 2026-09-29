import { supabase } from '@/lib/supabase/client';
import { assertAcademyWritable } from '@/lib/academy/preview';
import type { Academy2Operation } from './operations';
import type { InstructorApplicationDetailData } from './instructor-operations';

export type HeadquartersApplicationSummary = {
  applicationId: string; headquartersId: string; saleChannel: 'headquarters' | 'instructor';
  applicantName: string; planTitle: string; appliedAt: string; statusLabel: string;
  nextAction: string | null; revision: number;
  tuition?: { amount: number; currency: string; status: string; method: string };
  kitStatus: string | null; completedAt: string | null; certifiedAt: string | null;
};
export type HeadquartersApplicationDetail = {
  summary: HeadquartersApplicationSummary;
  headquarters: (Academy2Operation & {
    contactEmail: string | null; allowedActions: string[];
    event: { id: string; revision: number; startsAt: string | null; endsAt: string | null; format: 'in_person' | 'online'; venueName: string | null; meetingUrl: string | null } | null;
    shipping: { required: boolean; recipient?: 'learner' | 'instructor'; eventId?: string | null; status: string; address: string | null; shippedAt: string | null; trackingNumber: string | null };
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
export const listHeadquartersApplications = (headquartersId: string): Promise<HeadquartersApplicationSummary[]> => call('academy2_hq_applications', { p_headquarters_id: headquartersId });
export const getHeadquartersApplication = (headquartersId: string, applicationId: string): Promise<HeadquartersApplicationDetail> => call('academy2_hq_application', { p_headquarters_id: headquartersId, p_application_id: applicationId });
export function commandHeadquartersApplication(headquartersId: string, applicationId: string, expectedRevision: number, requestId: string, action: HeadquartersApplicationAction, input: Record<string, unknown> = {}): Promise<HeadquartersApplicationDetail> {
  assertAcademyWritable();
  return call('academy2_hq_application_command', { p_headquarters_id: headquartersId, p_application_id: applicationId, p_expected_revision: expectedRevision, p_request_id: requestId, p_action: action, p_input: input });
}
