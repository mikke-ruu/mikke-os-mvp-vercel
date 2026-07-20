import { supabase } from "@/lib/supabase/client";
import { logAcademyEvent } from "@/lib/academy/events";
import type { AcademyInstructor, AcademyKitOrder, Profile } from "@/types/database";

export const KIT_STATUS_LABELS: Record<AcademyKitOrder["status"], string> = {
  received: "注文受付",
  awaiting_payment: "入金待ち",
  paid: "入金済み",
  preparing: "準備中",
  shipped: "発送済み",
  closed: "完了",
  cancelled: "キャンセル"
};

export const KIT_STATUS_ORDER: AcademyKitOrder["status"][] = [
  "received",
  "awaiting_payment",
  "paid",
  "preparing",
  "shipped",
  "closed",
  "cancelled"
];

// 本部: 全キット注文
export async function listKitOrders(headquartersId: string) {
  const { data, error } = await supabase
    .from("academy_kit_orders")
    .select("*")
    .eq("headquarters_id", headquartersId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AcademyKitOrder[];
}

// 本部: ある申込に紐づくキット注文（申込詳細画面での相互リンク表示用）
export async function listKitOrdersByApplication(headquartersId: string, applicationId: string) {
  const { data, error } = await supabase
    .from("academy_kit_orders")
    .select("*")
    .eq("headquarters_id", headquartersId)
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AcademyKitOrder[];
}

// 講師: 自分の注文（RLSで自分の分だけ）
export async function listMyKitOrders(instructorIds: string[]) {
  if (instructorIds.length === 0) return [];
  const { data, error } = await supabase
    .from("academy_kit_orders")
    .select("*")
    .in("instructor_id", instructorIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AcademyKitOrder[];
}

// 講師: キットを本部に注文する
// Wave E (AC-E4/AC-E5): 「本部が見てよい情報だけの部分集合」を明示的に渡せるよう拡張。
// application.applicant_name/applicant_phoneに相当する値は呼び出し側からも絶対に渡さないこと。
export async function createKitOrder(
  profile: Profile,
  instructor: AcademyInstructor,
  input: {
    title: string;
    amount: number;
    courseId: string | null;
    applicationId?: string | null;
    shippingAddress?: string | null;
    desiredDate?: string | null;
    diplomaNameEn?: string | null;
    contactEmail?: string | null;
    instructorNote?: string | null;
  }
) {
  const { data, error } = await supabase
    .from("academy_kit_orders")
    .insert({
      headquarters_id: instructor.headquarters_id,
      course_id: input.courseId,
      instructor_id: instructor.id,
      user_id: profile.user_id,
      application_id: input.applicationId ?? null,
      shipping_address: input.shippingAddress ?? null,
      desired_date: input.desiredDate ?? null,
      diploma_name_en: input.diplomaNameEn ?? null,
      contact_email: input.contactEmail ?? null,
      instructor_note: input.instructorNote ?? null,
      title: input.title.trim(),
      amount: input.amount,
      status: "received",
      payment_status: "unpaid"
    })
    .select("*")
    .single();

  if (error) throw error;
  const order = data as AcademyKitOrder;

  await logAcademyEvent({
    headquartersId: instructor.headquarters_id,
    actorUserId: profile.user_id,
    actorProfileId: profile.id,
    ownerUserId: profile.user_id,
    eventType: "academy_kit_ordered",
    idempotencyKey: `academy:kit_ordered:${order.id}`,
    courseId: order.course_id,
    kitOrderId: order.id,
    title: `キットを注文しました（${order.title}）`
  });

  return order;
}

// 本部: ステータス・入金・決済URLの更新。節目でseam記録。
// 入金済みになったら DESK両側計上（本部=売上 / 講師=経費）を別行で記録する（§14）。
export async function updateKitOrder(
  hqOwnerProfile: Profile,
  headquartersId: string,
  prev: AcademyKitOrder,
  patch: Partial<{
    status: AcademyKitOrder["status"];
    payment_status: AcademyKitOrder["payment_status"];
    payment_url: string | null;
    amount: number;
  }>
) {
  const { data, error } = await supabase
    .from("academy_kit_orders")
    .update(patch)
    .eq("id", prev.id)
    .eq("headquarters_id", headquartersId)
    .select("*")
    .single();

  if (error) throw error;
  const next = data as AcademyKitOrder;

  // 発送済みになった
  if (patch.status === "shipped" && prev.status !== "shipped") {
    await logAcademyEvent({
      headquartersId,
      actorUserId: hqOwnerProfile.user_id,
      actorProfileId: hqOwnerProfile.id,
      ownerUserId: hqOwnerProfile.user_id,
      eventType: "academy_kit_shipped",
      idempotencyKey: `academy:kit_shipped:${next.id}`,
      courseId: next.course_id,
      kitOrderId: next.id,
      title: `キットを発送しました（${next.title}）`
    });
  }

  // 入金済みになった → 本部売上 / 講師経費 を両側に記録
  if (patch.payment_status === "paid" && prev.payment_status !== "paid") {
    // 講師のprofile情報（経費側の帰属先）
    const { data: insData } = await supabase
      .from("academy_instructors")
      .select("id, profile_id, user_id")
      .eq("id", next.instructor_id)
      .maybeSingle();

    await logAcademyEvent({
      headquartersId,
      actorUserId: hqOwnerProfile.user_id,
      actorProfileId: hqOwnerProfile.id,
      ownerUserId: hqOwnerProfile.user_id,
      eventType: "academy_kit_revenue",
      idempotencyKey: `academy:kit_paid:${next.id}:honbu`,
      courseId: next.course_id,
      kitOrderId: next.id,
      title: `キット売上を記録しました（${next.title}）`,
      hasFinancialValue: true,
      amount: next.amount,
      transactionType: "revenue",
      paymentStatus: "paid"
    });

    if (insData) {
      await logAcademyEvent({
        headquartersId,
        actorUserId: hqOwnerProfile.user_id,
        actorProfileId: insData.profile_id as string,
        ownerUserId: (insData.user_id as string | null) ?? undefined,
        eventType: "academy_kit_expense",
        idempotencyKey: `academy:kit_paid:${next.id}:koushi`,
        courseId: next.course_id,
        kitOrderId: next.id,
        title: `キット仕入れを記録しました（${next.title}）`,
        hasFinancialValue: true,
        amount: next.amount,
        transactionType: "expense",
        paymentStatus: "paid"
      });
    }
  }

  return next;
}
