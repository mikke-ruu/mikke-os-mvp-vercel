import { supabase } from "@/lib/supabase/client";
import { logAcademyEvent } from "@/lib/academy/events";
import type { AcademyInstructor, Profile } from "@/types/database";

export const INSTRUCTOR_STATUS_LABELS: Record<AcademyInstructor["status"], string> = {
  active: "活動中",
  dormant: "休眠",
  suspended: "停止",
  reapplying: "再開申請中"
};

export type InstructorProfileLite = Pick<Profile, "id" | "user_id" | "display_name" | "handle">;

// 更新期限アラート（§22 更新管理）: renewal_due が「過ぎている」か「30日以内」の講師を拾う。
// 活動中(is_active)の講師だけを対象にする（休眠・停止は対象外）。
const RENEWAL_WARNING_DAYS = 30;

export type RenewalAlert = {
  instructor: AcademyInstructor;
  daysUntilDue: number; // 負数=期限切れ
  isOverdue: boolean;
};

export function getRenewalAlerts(instructors: AcademyInstructor[]): RenewalAlert[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return instructors
    .filter((i) => i.is_active && i.renewal_due)
    .map((instructor) => {
      const due = new Date(instructor.renewal_due as string);
      due.setHours(0, 0, 0, 0);
      const daysUntilDue = Math.round((due.getTime() - today.getTime()) / 86400000);
      return { instructor, daysUntilDue, isOverdue: daysUntilDue < 0 };
    })
    .filter((a) => a.daysUntilDue <= RENEWAL_WARNING_DAYS)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

// 更新周期（本部設定の月数）から更新期限を計算する。基準日+周期。
export function calcRenewalDue(baseDate: string, periodMonths: number): string {
  const d = new Date(baseDate);
  d.setMonth(d.getMonth() + periodMonths);
  return d.toISOString().slice(0, 10);
}

// 同一人物が既に別講座で認定されている場合、そのとき割り当てた講師番号を探す。
// 講師番号は講座別ではなく本部単位で通し番号にするため、同じ人には同じ番号を引き継ぐ。
export async function findExistingInstructorNumber(headquartersId: string, profileId: string) {
  const { data, error } = await supabase
    .from("academy_instructors")
    .select("instructor_number")
    .eq("headquarters_id", headquartersId)
    .eq("profile_id", profileId)
    .not("instructor_number", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data?.instructor_number as string | null) ?? null;
}

// 講師に紐づけるMikke IDをハンドルで探す（profilesは公開読み取り可）
export async function findProfileByHandle(handle: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, display_name, handle")
    .eq("handle", handle.trim())
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as InstructorProfileLite | null;
}

export async function listInstructors(headquartersId: string) {
  const { data, error } = await supabase
    .from("academy_instructors")
    .select("*")
    .eq("headquarters_id", headquartersId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as AcademyInstructor[];
}

export async function getInstructor(headquartersId: string, id: string) {
  const { data, error } = await supabase
    .from("academy_instructors")
    .select("*")
    .eq("headquarters_id", headquartersId)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as AcademyInstructor;
}

export type InstructorInput = {
  courseId: string;
  handle: string; // 講師のMikke IDハンドル
  instructorNumber: string;
  certifiedAt: string;
  renewalDue: string;
  isCertified: boolean;
  isActive: boolean;
  isListed: boolean;
  acceptsApplications: boolean;
  businessName: string;
  area: string;
  memo: string;
};

// 本部が講師を登録（アカウント発行相当）。ハンドルからMikke IDを解決して紐づける。
export async function createInstructor(profile: Profile, headquartersId: string, input: InstructorInput) {
  const target = await findProfileByHandle(input.handle);
  if (!target) {
    throw new Error(`ハンドル「${input.handle}」のMikke IDが見つかりません。講師本人が先にMikke OSに登録している必要があります。`);
  }

  const { data, error } = await supabase
    .from("academy_instructors")
    .insert({
      headquarters_id: headquartersId,
      course_id: input.courseId,
      profile_id: target.id,
      user_id: target.user_id,
      instructor_number: input.instructorNumber || null,
      certified_at: input.certifiedAt || null,
      renewal_due: input.renewalDue || null,
      is_certified: input.isCertified,
      is_active: input.isActive,
      is_listed: input.isListed,
      accepts_applications: input.acceptsApplications,
      business_name: input.businessName || null,
      area: input.area || null,
      memo: input.memo || null
    })
    .select("*")
    .single();

  if (error) throw error;
  const instructor = data as AcademyInstructor;

  await logAcademyEvent({
    headquartersId,
    actorUserId: profile.user_id,
    actorProfileId: profile.id,
    ownerUserId: profile.user_id,
    eventType: "academy_instructor_registered",
    idempotencyKey: `academy:instructor_registered:${instructor.id}`,
    courseId: instructor.course_id,
    title: "認定講師を登録しました"
  });

  return instructor;
}

// 本部による更新（本部管理列＋営業列すべて可）。
export async function updateInstructor(
  headquartersId: string,
  instructor: AcademyInstructor,
  patch: Partial<{
    instructor_number: string | null;
    certified_at: string | null;
    renewal_due: string | null;
    is_certified: boolean;
    is_active: boolean;
    is_listed: boolean;
    accepts_applications: boolean;
    status: AcademyInstructor["status"];
    business_name: string | null;
    area: string | null;
    memo: string | null;
  }>
) {
  const { data, error } = await supabase
    .from("academy_instructors")
    .update(patch)
    .eq("id", instructor.id)
    .eq("headquarters_id", headquartersId)
    .select("*")
    .single();

  if (error) throw error;
  return data as AcademyInstructor;
}

// 更新完了操作。現在の期限（過ぎていれば今日）を基準に、本部の更新周期分だけ次の期限を自動計算する。
export async function renewInstructor(
  profile: Profile,
  headquartersId: string,
  instructor: AcademyInstructor,
  periodMonths: number
) {
  const today = new Date().toISOString().slice(0, 10);
  const base = instructor.renewal_due && instructor.renewal_due > today ? instructor.renewal_due : today;
  const nextDue = calcRenewalDue(base, periodMonths);

  const updated = await updateInstructor(headquartersId, instructor, { renewal_due: nextDue });

  await logAcademyEvent({
    headquartersId,
    actorUserId: profile.user_id,
    actorProfileId: profile.id,
    ownerUserId: profile.user_id,
    eventType: "academy_instructor_renewed",
    idempotencyKey: `academy:instructor_renewed:${instructor.id}:${nextDue}`,
    courseId: instructor.course_id,
    title: `認定講師の更新手続きを完了しました（次回更新: ${nextDue}）`
  });

  return updated;
}
