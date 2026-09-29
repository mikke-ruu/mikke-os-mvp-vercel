import { supabase } from "@/lib/supabase/client";
import { assertAcademyWritable } from "@/lib/academy/preview";

export type Academy2CourseSettings = {
  course_id: string; headquarters_id: string; reference_price: number | null;
  all_courses_eligible: boolean | null; revision: number; updated_at: string | null;
};
function settingsError(error: { code?: string }): Error {
  if (error.code === "42501") return new Error("この講座の設定を確認・変更する権限がありません。");
  if (error.code === "PT409") return new Error("設定が更新されています。最新の内容を読み直してください。");
  if (error.code === "22023") return new Error("参考価格は0円以上の整数で入力してください。未設定にもできます。");
  if (error.code === "PGRST202" || error.code === "42883") return new Error("講座の参考価格設定を準備しています。");
  return new Error("講座の設定を処理できませんでした。入力内容を残して、もう一度お試しください。");
}
export async function getAcademy2CourseSettings(headquartersId: string, courseId: string): Promise<Academy2CourseSettings> {
  const { data, error } = await supabase.rpc("academy2_course_settings", { p_headquarters_id: headquartersId, p_course_id: courseId });
  if (error) throw settingsError(error);
  return data as Academy2CourseSettings;
}
export async function saveAcademy2CourseSettings(headquartersId: string, courseId: string, expectedRevision: number, referencePrice: number | null, allCoursesEligible: boolean | null): Promise<Academy2CourseSettings> {
  assertAcademyWritable();
  const { data, error } = await supabase.rpc("academy2_save_course_settings", { p_headquarters_id: headquartersId, p_course_id: courseId, p_expected_revision: expectedRevision, p_reference_price: referencePrice, p_all_courses_eligible: allCoursesEligible });
  if (error) throw settingsError(error);
  return data as Academy2CourseSettings;
}
