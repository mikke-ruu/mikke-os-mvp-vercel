import { supabase } from "@/lib/supabase/client";
import {
  academyPreviewCourses,
  academyPreviewHeadquarters,
  academyPreviewInstructors,
  assertAcademyWritable,
  isAcademyLocalReview
} from "@/lib/academy/preview";
import type {
  AcademyCourse,
  AcademyHeadquarters,
  AcademyInstructor,
  AcademyLpBlock,
  AcademyPaymentProvider
} from "@/types/database";

// 公開フロント: URLで指定された本部だけを取得する。
// 本部を指定せず「最古の1件」を返すとテナント混線になるため、handleは必須。
export async function getPublicHeadquarters(handle: string) {
  if (isAcademyLocalReview()) return handle === academyPreviewHeadquarters.handle ? academyPreviewHeadquarters : null;
  const normalizedHandle = handle.trim().toLowerCase();
  if (!normalizedHandle) return null;

  const { data, error } = await supabase
    .from("academy_headquarters")
    .select("*")
    .eq("handle", normalizedHandle)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as AcademyHeadquarters | null;
}

// 管理画面・講師ポータルから、所属本部の公開URLを組み立てるための取得。
export async function listPublicHeadquartersByIds(headquartersIds: string[]) {
  if (isAcademyLocalReview()) return headquartersIds.includes(academyPreviewHeadquarters.id) ? [academyPreviewHeadquarters] : [];
  const ids = [...new Set(headquartersIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("academy_headquarters")
    .select("*")
    .in("id", ids)
    .eq("is_active", true);
  if (error) throw error;
  return (data ?? []) as AcademyHeadquarters[];
}

// 公開フロント: 公開中の講座一覧
export async function listPublishedCourses(headquartersId?: string) {
  if (isAcademyLocalReview()) return academyPreviewCourses.filter((item) => item.is_published && (!headquartersId || item.headquarters_id === headquartersId));
  let query = supabase
    .from("academy_courses")
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (headquartersId) query = query.eq("headquarters_id", headquartersId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AcademyCourse[];
}

// 公開フロント: 掲載中の講師一覧（RLSで is_listed=true のみ匿名でも読める）
export async function listListedInstructors(headquartersId?: string) {
  if (isAcademyLocalReview()) return academyPreviewInstructors.filter((item) => item.is_listed && (!headquartersId || item.headquarters_id === headquartersId));
  let query = supabase
    .from("academy_instructors")
    .select("*")
    .eq("is_listed", true)
    .order("created_at", { ascending: true });
  if (headquartersId) query = query.eq("headquarters_id", headquartersId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AcademyInstructor[];
}

// 公開LP: 講座を取得（RLSで公開中のみ匿名でも読める）
export async function getPublicCourse(courseId: string) {
  if (isAcademyLocalReview()) return academyPreviewCourses.find((item) => item.id === courseId && item.is_published) ?? null;
  const { data, error } = await supabase.from("academy_courses").select("*").eq("id", courseId).maybeSingle();
  if (error) throw error;
  return (data ?? null) as AcademyCourse | null;
}

// 公開LP: 担当講師（掲載中のみ匿名でも読める）
export async function getListedInstructor(instructorId: string) {
  if (isAcademyLocalReview()) return academyPreviewInstructors.find((item) => item.id === instructorId && item.is_listed) ?? null;
  const { data, error } = await supabase
    .from("academy_instructors")
    .select("*")
    .eq("id", instructorId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as AcademyInstructor | null;
}

// 本部: LPブロックを保存
export async function saveLpBlocks(headquartersId: string, courseId: string, blocks: AcademyLpBlock[]) {
  assertAcademyWritable();
  const { data, error } = await supabase
    .from("academy_courses")
    .update({ lp_blocks: blocks })
    .eq("id", courseId)
    .eq("headquarters_id", headquartersId)
    .select("*")
    .single();
  if (error) throw error;
  return data as AcademyCourse;
}

// 受講者（匿名可）: 公開フォームから申込を送信
export type PublicApplicationInput = {
  course: AcademyCourse;
  instructorId: string | null; // 講師ページ経由なら講師id
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  applicantNote: string;
  eventDate: string;
  format: "in_person" | "online" | "";
  formAnswers: Record<string, string>;
  // Wave E (AC-E2): ディプロマに入れる英語表記名（必須項目）。
  diplomaNameEn: string;
  // Wave E (AC-E2): オンライン受講時のみ入力する配送先情報。
  applicantShippingAddress: string;
};

export async function submitPublicApplication(input: PublicApplicationInput) {
  assertAcademyWritable();
  if (!input.instructorId) {
    const { data, error } = await supabase.functions.invoke("academy-application-intake", {
      body: {
        course_id: input.course.id,
        instructor_id: null,
        applicant_name: input.applicantName,
        applicant_email: input.applicantEmail,
        applicant_phone: input.applicantPhone,
        applicant_note: input.applicantNote,
        form_answers: input.formAnswers,
        event_date: input.eventDate,
        format: input.format,
        diploma_name_en: input.diplomaNameEn,
        applicant_shipping_address: input.applicantShippingAddress
      }
    });
    if (error) throw error;
    if (!data?.application_id) throw new Error(data?.error ?? "申込の受付結果を確認できませんでした。");
    return data as {
      application_id: string;
      payment_provider: AcademyPaymentProvider;
      payment_url: string | null;
      email_sent: boolean;
    };
  }

  const { data, error } = await supabase.rpc("academy_submit_public_application", {
    p_course_id: input.course.id,
    p_instructor_id: input.instructorId,
    p_applicant_name: input.applicantName,
    p_applicant_email: input.applicantEmail,
    p_applicant_phone: input.applicantPhone,
    p_applicant_note: input.applicantNote,
    p_form_answers: input.formAnswers,
    p_event_date: input.eventDate,
    p_format: input.format,
    p_diploma_name_en: input.diplomaNameEn,
    p_applicant_shipping_address: input.applicantShippingAddress
  });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.application_id) throw new Error("申込の受付結果を確認できませんでした。");
  return result as {
    application_id: string;
    payment_provider: AcademyPaymentProvider;
    payment_url: string | null;
  };
}
