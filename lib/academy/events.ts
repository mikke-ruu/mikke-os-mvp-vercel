import { supabase } from "@/lib/supabase/client";
import { assertAcademyWritable } from "@/lib/academy/preview";

// mikkeOS変換用ローカルイベントログ（seam）への記録ヘルパー。
// 本接続はまだしない。ここに貯めた行を後で activity_logs へ写像する。
// 安全既定: visibility=private / display系すべてfalse。公開は明示指定のときだけ。
// Storyへ生の個人情報を残さない前提（title/descriptionは公開可能表現に）。

type LogAcademyEventInput = {
  headquartersId: string;
  actorUserId?: string | null;
  actorProfileId?: string | null;
  ownerUserId?: string | null;

  eventType: string;
  // 冪等キー。二重Activity Log化を防ぐ。例: academy:course_sale:{applicationId}
  idempotencyKey?: string | null;

  // 対象ID（イベントにより一部のみ）
  courseId?: string | null;
  lessonId?: string | null;
  enrollmentId?: string | null;
  certificationId?: string | null;
  materialId?: string | null;
  applicationId?: string | null;
  kitOrderId?: string | null;

  title?: string | null;
  description?: string | null;

  // 金額（DESK変換用）
  hasFinancialValue?: boolean;
  amount?: number | null;
  transactionType?: "revenue" | "expense" | "none";
  paymentStatus?: "unpaid" | "paid" | "not_required";

  // 公開・集計の判定（activity_logs と同名）
  visibility?: "public" | "private" | "limited";
  displayOnStory?: boolean;
  displayInTimeline?: boolean;
  displayAsAchievement?: boolean;
  countsTowardSummary?: boolean;

  occurredAt?: string;
};

export async function logAcademyEvent(input: LogAcademyEventInput) {
  assertAcademyWritable();
  const hasFinancialValue = input.hasFinancialValue ?? false;

  const payload = {
    headquarters_id: input.headquartersId,
    actor_user_id: input.actorUserId ?? null,
    actor_profile_id: input.actorProfileId ?? null,
    owner_user_id: input.ownerUserId ?? null,

    event_type: input.eventType,
    idempotency_key: input.idempotencyKey ?? null,

    course_id: input.courseId ?? null,
    lesson_id: input.lessonId ?? null,
    enrollment_id: input.enrollmentId ?? null,
    certification_id: input.certificationId ?? null,
    material_id: input.materialId ?? null,
    application_id: input.applicationId ?? null,
    kit_order_id: input.kitOrderId ?? null,

    title: input.title ?? null,
    description: input.description ?? null,

    has_financial_value: hasFinancialValue,
    amount: hasFinancialValue ? input.amount ?? 0 : null,
    transaction_type: hasFinancialValue ? input.transactionType ?? "revenue" : "none",
    payment_status: hasFinancialValue ? input.paymentStatus ?? "unpaid" : "not_required",

    visibility: input.visibility ?? "private",
    display_on_story: input.displayOnStory ?? false,
    display_in_timeline: input.displayInTimeline ?? false,
    display_as_achievement: input.displayAsAchievement ?? false,
    counts_toward_summary: input.countsTowardSummary ?? false,

    occurred_at: input.occurredAt ?? new Date().toISOString()
  };

  // idempotency_key があれば二重記録を握りつぶす（同じ操作の再送を許容）。
  const query = input.idempotencyKey
    ? supabase.from("academy_activity_events").upsert(payload, { onConflict: "idempotency_key" })
    : supabase.from("academy_activity_events").insert(payload);

  const { error } = await query;
  if (error) throw error;
}
