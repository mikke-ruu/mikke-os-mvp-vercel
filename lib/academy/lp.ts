import { supabase } from "@/lib/supabase/client";
import type { AcademyCourse, AcademyHeadquarters, AcademyInstructor, AcademyLpBlock } from "@/types/database";

// 公開フロント: 本部（MVPは1件想定。将来はhandleで切替）
export async function getPublicHeadquarters() {
  const { data, error } = await supabase
    .from("academy_headquarters")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as AcademyHeadquarters | null;
}

// 公開フロント: 公開中の講座一覧
export async function listPublishedCourses(headquartersId?: string) {
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
  const { data, error } = await supabase.from("academy_courses").select("*").eq("id", courseId).maybeSingle();
  if (error) throw error;
  return (data ?? null) as AcademyCourse | null;
}

// 公開LP: 担当講師（掲載中のみ匿名でも読める）
export async function getListedInstructor(instructorId: string) {
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
};

export async function submitPublicApplication(input: PublicApplicationInput) {
  const intakeSource = input.instructorId ? "koushi" : "honbu";
  const { error } = await supabase.from("academy_applications").insert({
    headquarters_id: input.course.headquarters_id,
    course_id: input.course.id,
    user_id: null,
    intake_source: intakeSource,
    instructor_id: input.instructorId,
    applicant_name: input.applicantName.trim(),
    applicant_email: input.applicantEmail || null,
    applicant_phone: input.applicantPhone || null,
    applicant_note: input.applicantNote || null,
    form_answers: input.formAnswers,
    event_date: input.eventDate || null,
    format: input.format || null,
    price: input.course.price,
    kit_cost: 0,
    honbu_revenue: 0,
    instructor_revenue: 0,
    status: "received",
    payment_status: "unpaid",
    certification_status: "not_yet",
    display_on_story: false,
    reflect_on_desk: false
  });

  if (error) throw error;
}
