import { supabase } from "@/lib/supabase/client";
import { logAcademyEvent } from "@/lib/academy/events";
import { findExistingInstructorNumber } from "@/lib/academy/instructors";
import type { AcademyApplication, AcademyInstructor, Profile } from "@/types/database";

// Wave E (AC-E7): 受講後の任意講師登録・community参加フロー。
// RLSは「申込者本人（user_id = auth.uid()）」の行だけを返す前提（§9のAC-E6を参照）。
// 自分の行以外は常に0件で返るため、これらの関数はRLSの範囲内でしか動作しない＝安全。

// ログイン中ユーザー自身の申込をidで取得（自分の行でなければRLSにより null になる）
export async function getMyApplicationById(id: string) {
  const { data, error } = await supabase.from("academy_applications").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as AcademyApplication | null;
}

// フォールバック: 申込時と異なるメールで今ログインしている場合、
// 入力されたメールアドレスで自分（user_id=auth.uid()）の申込を再検索する。
export async function findMyApplicationsByEmail(email: string) {
  const trimmed = email.trim();
  if (!trimmed) return [];
  const { data, error } = await supabase
    .from("academy_applications")
    .select("*")
    .ilike("applicant_email", trimmed)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AcademyApplication[];
}

// community参加の意思だけを保存する（Community本体が無いため実処理はしない＝予約のみ）
export async function setCommunityInterest(applicationId: string, interested: boolean) {
  const { data, error } = await supabase
    .from("academy_applications")
    .update({ community_interest: interested })
    .eq("id", applicationId)
    .select("*")
    .single();
  if (error) throw error;
  return data as AcademyApplication;
}

// 認定講師登録（受講者自身の任意操作）。
// instructors.ts の講師番号採番ロジック（findExistingInstructorNumber）を再利用し、
// is_certified/is_active/accepts_applications をtrueで初期化する（営業ページ・認定講師一覧に反映される）。
export async function registerAsInstructorFromGraduation(profile: Profile, application: AcademyApplication) {
  const instructorNumber = await findExistingInstructorNumber(application.headquarters_id, profile.id);

  const { data, error } = await supabase
    .from("academy_instructors")
    .insert({
      headquarters_id: application.headquarters_id,
      course_id: application.course_id,
      profile_id: profile.id,
      user_id: profile.user_id,
      instructor_number: instructorNumber,
      certified_at: new Date().toISOString().slice(0, 10),
      is_certified: true,
      is_active: true,
      is_listed: true,
      accepts_applications: true
    })
    .select("*")
    .single();

  if (error) throw error;
  const instructor = data as AcademyInstructor;

  await logAcademyEvent({
    headquartersId: application.headquarters_id,
    actorUserId: profile.user_id,
    actorProfileId: profile.id,
    ownerUserId: profile.user_id,
    eventType: "academy_certified",
    idempotencyKey: `academy:certified:self:${instructor.id}`,
    courseId: instructor.course_id,
    applicationId: application.id,
    title: "認定講師登録が完了しました",
    countsTowardSummary: true
  });

  return instructor;
}
