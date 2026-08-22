import { supabase } from "@/lib/supabase/client";
import { academyPreviewApplications, assertAcademyWritable, isAcademyLocalReview } from "@/lib/academy/preview";
import type { AcademyApplication } from "@/types/database";

// Wave E (AC-E7): 受講後の任意講師登録・community参加フロー。
// RLSは「申込者本人（user_id = auth.uid()）」の行だけを返す前提（§9のAC-E6を参照）。
// 自分の行以外は常に0件で返るため、これらの関数はRLSの範囲内でしか動作しない＝安全。

// ログイン中ユーザー自身の申込をidで取得（自分の行でなければRLSにより null になる）
export async function getMyApplicationById(id: string) {
  if (isAcademyLocalReview()) return academyPreviewApplications.find((item) => item.id === id) ?? null;
  const { data, error } = await supabase.from("academy_applications").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as AcademyApplication | null;
}

// フォールバック: 申込時と異なるメールで今ログインしている場合、
// 入力されたメールアドレスで自分（user_id=auth.uid()）の申込を再検索する。
export async function findMyApplicationsByEmail(email: string) {
  if (isAcademyLocalReview()) return academyPreviewApplications;
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
  assertAcademyWritable();
  const { data, error } = await supabase
    .from("academy_applications")
    .update({ community_interest: interested })
    .eq("id", applicationId)
    .select("*")
    .single();
  if (error) throw error;
  return data as AcademyApplication;
}
