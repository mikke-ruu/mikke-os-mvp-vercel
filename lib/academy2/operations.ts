import { supabase } from "@/lib/supabase/client";
import { assertAcademyWritable } from "@/lib/academy/preview";

export type Academy2EventSummary = {
  id: string; headquarters_id: string; title: string;
  sales_plan_id: string | null; sales_plan_name: string | null; course_name: string;
  main_image_url: string | null; instructor_name: string | null; applicant_names: string[];
  instructor_response_status: string | null;
  schedule_mode: "fixed" | "arranged_after_application";
  starts_at: string | null; ends_at: string | null; format: "in_person" | "online";
  capacity: number | null; application_count: number; status: string;
  registration_status: "draft" | "open" | "closed"; revision: number | null;
};
export type EventSummary = Academy2EventSummary;
export type EventKitMethod = 'shipping' | 'venue_handover';
export type EventKitSettings = {enabled: boolean; name?: string; methods: EventKitMethod[]; recipient?: string};
export type Academy2EventDetail = Academy2EventSummary & {
  course_id: string;
  plan_revision: number | null;
  kit_method: EventKitMethod | null;
  kit_settings: EventKitSettings;
  allowed_methods: ("online" | "in_person")[];
  venue_name: string | null;
  meeting_url: string | null;
};
async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const messages: Record<string, string> = {
      academy2_publication_or_terms_changed: "公開状態、価格または規約が更新されています。販売プランの最新情報を確認してください。",
      academy2_public_source_unavailable: "募集を開始できる状態ではありません。本部と販売プランの公開条件を確認してください。",
      academy2_operational_scope_on_hold: "この販売プランには、まだ申込処理へ接続していない設定が含まれています。対応範囲を確認してください。",
      academy2_invalid_kit_method: "販売プランで許可されたキットの受け渡し方法を選択してください。",
      academy2_kit_method_locked: "申込のある開催や受付中の開催では、キットの受け渡し方法を変更できません。",
      academy2_event_full: "この開催は定員に達しています。別の開催を選んでください。",
      academy2_review_required: "入金状態と確認内容を確認してください。修了・認定には確認した内容の記録が必要です。",
      academy2_event_not_ready: "開催の受講方法と日程の設定を確認してください。",
    };
    const message = Object.hasOwn(messages, error.message) ? messages[error.message] : error.code === "42501" ? "この本部の情報を操作する権限がありません。" : error.code === "PT409" ? "別の変更が保存されています。最新の状態を確認してください。" : error.code === "22023" ? "入力内容や現在の状態を確認してください。入力した内容はそのまま残っています。" : "処理を確認できませんでした。入力内容を残して、もう一度お試しください。";
    throw Object.assign(new Error(message), {code: error.code});
  }
  return data as T;
}
export async function listAcademy2Events(headquartersId: string): Promise<Academy2EventSummary[]> {
  return call("academy2_events", { p_headquarters_id: headquartersId });
}
export async function getAcademy2Event(headquartersId: string, eventId: string): Promise<Academy2EventDetail> {
  return call("academy2_event", { p_headquarters_id: headquartersId, p_event_id: eventId });
}
export type Academy2Operation = {
  id: string; headquarters_id: string; sales_plan_id: string; sales_plan_name: string;
  applicant_name: string; class_id: string | null; revision: number;
  completed_at: string | null; certified_at: string | null;
  consent_version: string; consented_at: string;
  next_action: "confirm_payment" | "wait" | "confirm_schedule" | "confirm_completion" | "review_outcome" | "done";
  price?: number; payment_status?: "pending" | "paid"; payment_method?: "bank"; paid_at?: string | null;
};
export async function listAcademy2Operations(headquartersId: string): Promise<Academy2Operation[]> {
  return call("academy2_operations", {p_headquarters_id: headquartersId});
}
export async function getAcademy2Operation(headquartersId: string, applicationId: string): Promise<Academy2Operation> {
  return call("academy2_operation", {p_headquarters_id: headquartersId,p_application_id: applicationId});
}
export async function bindAcademy2OperationSource(headquartersId: string, offeringId: string, planId: string, revision: number): Promise<{offering_id: string; plan_id: string; plan_revision: number; publication_changed: false}> {
  assertAcademyWritable();
  return call("academy2_bind_operation_source", {p_headquarters_id: headquartersId,p_offering_id: offeringId,p_plan_id: planId,p_revision: revision});
}
export async function submitAcademy2Operation(input: {offeringId: string; requestId: string; applicantName: string; termsVersion: string; agreed: boolean; expectedPrice: number; classId: string | null}): Promise<Academy2Operation> {
  assertAcademyWritable();
  return call("academy2_submit_operation", {p_offering_id: input.offeringId,p_request_id: input.requestId,p_name: input.applicantName,p_terms_version: input.termsVersion,p_agree: input.agreed,p_expected_price: input.expectedPrice,p_class_id: input.classId});
}
export async function applyAcademy2Operation(headquartersId: string, applicationId: string, expectedRevision: number, requestId: string, action: "confirm_payment" | "confirm_completion" | "confirm_certification", reviewNote?: string): Promise<Academy2Operation> {
  assertAcademyWritable();
  return call("academy2_operation_command", {p_headquarters_id: headquartersId,p_application_id: applicationId,p_expected_revision: expectedRevision,p_request_id: requestId,p_action: action,p_input: reviewNote === undefined ? {} : {review_note: reviewNote}});
}
export type Academy2EventInput = {
  title: string; scheduleMode: "fixed" | "arranged_after_application";
  startsAt: string | null; endsAt: string | null; format: "online" | "in_person";
  capacity: number | null; venueName?: string; meetingUrl?: string; kitMethod?: EventKitMethod | null;
};
function eventInput(input: Academy2EventInput) {
  return {title: input.title,schedule_mode: input.scheduleMode,starts_at: input.startsAt,ends_at: input.endsAt,format: input.format,capacity: input.capacity,venue_name: input.venueName ?? null,meeting_url: input.meetingUrl ?? null,...(input.kitMethod === undefined ? {} : {kit_method:input.kitMethod})};
}
export async function createAcademy2Event(headquartersId: string, requestId: string, input: Academy2EventInput & {planId: string; planRevision: number; courseId: string}): Promise<Academy2EventSummary> {
  assertAcademyWritable();
  return call("academy2_create_event", {p_headquarters_id: headquartersId,p_request_id: requestId,p_input: {...eventInput(input),plan_id: input.planId,plan_revision: input.planRevision,course_id: input.courseId}});
}
export async function updateAcademy2Event(headquartersId: string, eventId: string, expectedRevision: number, requestId: string, input: Academy2EventInput): Promise<Academy2EventSummary> {
  assertAcademyWritable();
  return call("academy2_update_event", {p_headquarters_id: headquartersId,p_event_id: eventId,p_expected_revision: expectedRevision,p_request_id: requestId,p_input: eventInput(input)});
}
export async function setAcademy2EventRegistration(headquartersId: string, eventId: string, expectedRevision: number, requestId: string, registrationStatus: "open" | "closed", offeringId: string | null = null): Promise<Academy2EventSummary> {
  assertAcademyWritable();
  return call("academy2_event_registration", {p_headquarters_id: headquartersId,p_event_id: eventId,p_expected_revision: expectedRevision,p_request_id: requestId,p_registration_status: registrationStatus,p_offering_id: offeringId});
}

/** Scheduling projection deliberately excludes plan prices and contract settings. */
export type Academy2EventPlanChoice = {
 id: string; revision: number;
 configuration: {title: string; study_style: 'instructor'; allowed_methods: ('online'|'in_person')[]; kit: EventKitSettings};
 course_snapshot: {course_id: string; title: string}[];
};
export async function listAcademy2EventPlanChoices(headquartersId: string): Promise<Academy2EventPlanChoice[]> {
 return call('academy2_event_plan_choices', {p_headquarters_id: headquartersId});
}
