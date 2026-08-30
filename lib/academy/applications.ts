import { supabase } from "@/lib/supabase/client";
import { logAcademyEvent } from "@/lib/academy/events";
import {
  academyPreviewApplications,
  academyPreviewNotifications,
  assertAcademyWritable,
  isAcademyLocalReview
} from "@/lib/academy/preview";
import type {
  AcademyApplication,
  AcademyApplicationNotification,
  AcademyApplicationStatus,
  AcademyInstructor,
  Profile
} from "@/types/database";

export const APPLICATION_STATUS_LABELS: Record<AcademyApplicationStatus, string> = {
  received: "申込受付",
  awaiting_payment: "入金待ち",
  paid: "入金済み",
  kit_pending: "キット注文待ち",
  kit_preparing: "キット発送準備中",
  kit_shipped: "キット発送済み",
  scheduled: "受講日決定",
  completed: "受講完了",
  cert_pending: "認定待ち",
  certified: "認定済み",
  instructor_added: "講師登録済み",
  closed: "完了",
  cancelled: "キャンセル"
};

export const APPLICATION_STATUS_ORDER: AcademyApplicationStatus[] = [
  "received",
  "awaiting_payment",
  "paid",
  "kit_pending",
  "kit_preparing",
  "kit_shipped",
  "scheduled",
  "completed",
  "cert_pending",
  "certified",
  "instructor_added",
  "closed",
  "cancelled"
];

// Wave F (AC-F5e): requires_kit=falseの講座では、キット系ステータスをUIの選択肢から除外する
// （データ・型は変更しない。表示だけの絞り込み）。
const KIT_ONLY_STATUSES: AcademyApplicationStatus[] = ["kit_pending", "kit_preparing", "kit_shipped"];

export function visibleStatusOptions(requiresKit: boolean): AcademyApplicationStatus[] {
  if (requiresKit) return APPLICATION_STATUS_ORDER;
  return APPLICATION_STATUS_ORDER.filter((s) => !KIT_ONLY_STATUSES.includes(s));
}

export type ApplicationInput = {
  courseId: string;
  intakeSource: "honbu" | "koushi";
  instructorId: string | null;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  applicantNote: string;
  eventDate: string;
  format: "in_person" | "online" | "";
  price: number;
  kitCost: number;
  honbuRevenue: number;
  instructorRevenue: number;
  // Wave E (AC-E3): 公開申込フォームと項目を揃える。
  diplomaNameEn: string;
  applicantShippingAddress: string;
};

export async function listApplications(headquartersId: string) {
  if (isAcademyLocalReview()) return academyPreviewApplications;
  const { data, error } = await supabase
    .from("academy_applications")
    .select("*")
    .eq("headquarters_id", headquartersId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as AcademyApplication[];
}

export async function getApplication(headquartersId: string, id: string) {
  if (isAcademyLocalReview()) return academyPreviewApplications.find((item) => item.id === id) ?? academyPreviewApplications[0];
  const { data, error } = await supabase
    .from("academy_applications")
    .select("*")
    .eq("headquarters_id", headquartersId)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as AcademyApplication;
}

export async function listApplicationNotifications(applicationId: string) {
  if (isAcademyLocalReview()) return academyPreviewNotifications;
  const { data, error } = await supabase.rpc("academy_list_application_notifications", {
    p_application_id: applicationId
  });
  if (error) throw error;
  return (data ?? []) as AcademyApplicationNotification[];
}

export async function retryApplicationNotifications(applicationId: string) {
  assertAcademyWritable();
  const { data, error } = await supabase.functions.invoke("academy-application-email-retry", {
    body: { application_id: applicationId }
  });
  if (error) throw error;
  if (data?.sent !== true) throw new Error(data?.error ?? "再送できなかったメールがあります。");
  return data as { sent: true; sent_count: number; attempted_count?: number };
}

export async function promoteCertifiedApplicationToInstructor(applicationId: string, profileId: string) {
  assertAcademyWritable();
  const { data, error } = await supabase.rpc("academy_promote_certified_application", {
    p_application_id: applicationId,
    p_profile_id: profileId
  });
  if (error) throw error;
  return data as AcademyInstructor;
}

export async function createApplication(profile: Profile, headquartersId: string, input: ApplicationInput) {
  assertAcademyWritable();
  const { data, error } = await supabase
    .from("academy_applications")
    .insert({
      headquarters_id: headquartersId,
      course_id: input.courseId,
      // The operator is not the learner. The learner claims this application
      // later with a verified login email through academy_claim_my_application.
      user_id: null,
      intake_source: input.intakeSource,
      instructor_id: input.instructorId,
      applicant_name: input.applicantName.trim(),
      applicant_email: input.applicantEmail || null,
      applicant_phone: input.applicantPhone || null,
      applicant_note: input.applicantNote || null,
      event_date: input.eventDate || null,
      format: input.format || null,
      diploma_name_en: input.diplomaNameEn.trim() || null,
      applicant_shipping_address: input.applicantShippingAddress || null,
      price: input.price,
      kit_cost: input.kitCost,
      honbu_revenue: input.honbuRevenue,
      instructor_revenue: input.instructorRevenue
    })
    .select("*")
    .single();

  if (error) throw error;
  const app = data as AcademyApplication;

  // seam: 申込受付（個人情報は入れず、講座単位の事実だけ残す）
  await logAcademyEvent({
    headquartersId,
    actorUserId: profile.user_id,
    actorProfileId: profile.id,
    ownerUserId: profile.user_id,
    eventType: "academy_application_received",
    idempotencyKey: `academy:application_received:${app.id}`,
    courseId: app.course_id,
    applicationId: app.id,
    title: "講座申込を受け付けました"
  });

  return app;
}

// 詳細＋ステータス更新。差分で節目イベントを seam に記録する。
export async function updateApplication(
  profile: Profile,
  headquartersId: string,
  prev: AcademyApplication,
  patch: Partial<{
    status: AcademyApplicationStatus;
    payment_status: AcademyApplication["payment_status"];
    certification_status: AcademyApplication["certification_status"];
    event_date: string | null;
    format: AcademyApplication["format"];
    price: number;
    kit_cost: number;
    honbu_revenue: number;
    instructor_revenue: number;
    applicant_note: string | null;
  }>
) {
  assertAcademyWritable();
  const { data, error } = await supabase
    .from("academy_applications")
    .update(patch)
    .eq("id", prev.id)
    .eq("headquarters_id", headquartersId)
    .select("*")
    .single();

  if (error) throw error;
  const next = data as AcademyApplication;

  const base = {
    headquartersId,
    actorUserId: profile.user_id,
    actorProfileId: profile.id,
    ownerUserId: profile.user_id,
    courseId: next.course_id,
    applicationId: next.id
  };

  // 入金確認の事実だけを連携する。金額と決済識別子は
  // Academyの決済台帳を正とし、Activity Logには保存しない。
  if (patch.payment_status === "paid" && prev.payment_status !== "paid") {
    await logAcademyEvent({
      ...base,
      eventType: "academy_payment_received",
      idempotencyKey: `academy:payment_received:${next.id}`,
      title: "受講料の入金を確認しました",
      paymentStatus: "paid",
      visibility: "private"
    });
  }

  // 受講完了 → 実績候補（既定は非公開。公開判断は後で）
  if (patch.status === "completed" && prev.status !== "completed") {
    await logAcademyEvent({
      ...base,
      eventType: "academy_course_completed",
      idempotencyKey: `academy:course_completed:${next.id}`,
      title: "受講が完了しました",
      countsTowardSummary: true
    });
  }

  // 認定完了
  if (patch.certification_status === "certified" && prev.certification_status !== "certified") {
    await logAcademyEvent({
      ...base,
      eventType: "academy_certified",
      idempotencyKey: `academy:certified:${next.id}`,
      title: "認定が完了しました",
      countsTowardSummary: true
    });
  }

  return next;
}
