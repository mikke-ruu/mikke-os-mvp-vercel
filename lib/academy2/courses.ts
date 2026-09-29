import { supabase } from "@/lib/supabase/client";
import { assertAcademyWritable } from "@/lib/academy/preview";

export type Academy2Course = {
  id: string; headquarters_id: string; user_id: string; code: string; name: string;
  subtitle: string | null; main_image_url: string | null; description: string | null;
  duration_text: string | null; created_at: string; updated_at: string;
  reference_price: number | null; reference_revision: number; lesson_count: number | null; material_count?: number | null;
  target_audience?: string;
  show_introduction?: boolean;
};
export type Academy2CourseInput = {
  code?: string; name?: string; subtitle?: string | null; mainImageUrl?: string | null;
  description?: string | null; durationText?: string | null;
};
function courseError(error: {code?: string}, operation: 'read' | 'save' = 'read'): Error {
  if (error.code === "42501") return new Error("この講座を確認・変更する権限がありません。");
  if (error.code === "PT409") return new Error("講座が更新されています。入力内容を控えて、最新の内容を読み直してください。");
  if (error.code === "22023") return new Error("講座名と管理コードなど、入力内容を確認してください。");
  return new Error(operation === 'read' ? "講座を読み込めませんでした。もう一度読み込んでください。" : "講座の保存結果を確認できませんでした。入力内容を残したまま、最新の内容を確認してください。");
}
export async function getAcademy2Course(headquartersId: string, courseId: string): Promise<Academy2Course> {
  const { data, error } = await supabase.rpc("academy2_course", {p_headquarters_id: headquartersId, p_course_id: courseId});
  if (error) throw courseError(error);
  return data as Academy2Course;
}
export async function listAcademy2Courses(headquartersId: string): Promise<Academy2Course[]> {
  const { data, error } = await supabase.rpc("academy2_courses", {p_headquarters_id: headquartersId});
  if (error) throw courseError(error);
  return data as Academy2Course[];
}
export async function updateAcademy2Course(headquartersId: string, courseId: string, expectedUpdatedAt: string, input: Academy2CourseInput): Promise<Academy2Course> {
  assertAcademyWritable();
  const row: Record<string,string|null> = {};
  const fields = {code: "code", name: "name", subtitle: "subtitle", mainImageUrl: "main_image_url", description: "description", durationText: "duration_text"} as const;
  for (const key of Object.keys(input)) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) throw new Error("この画面では講座の基本情報のみ保存できます。");
    const typedKey = key as keyof Academy2CourseInput;
    if (input[typedKey] !== undefined) row[fields[typedKey]] = input[typedKey]!;
  }
  const {data,error} = await supabase.rpc("academy2_update_course", {p_headquarters_id: headquartersId,p_course_id: courseId,p_expected_updated_at: expectedUpdatedAt,p_input: row});
  if (error) throw courseError(error, 'save');
  return data as Academy2Course;
}
export async function createAcademy2Course(headquartersId: string, creationId: string, input: Academy2CourseInput): Promise<Academy2Course> {
  assertAcademyWritable();
  const row: Record<string,string|null> = {};
  const fields = {code: "code", name: "name", subtitle: "subtitle", mainImageUrl: "main_image_url", description: "description", durationText: "duration_text"} as const;
  for (const key of Object.keys(input)) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) throw new Error("この画面では講座の基本情報のみ保存できます。");
    const typedKey = key as keyof Academy2CourseInput;
    if (input[typedKey] !== undefined) row[fields[typedKey]] = input[typedKey]!;
  }
  const {data,error} = await supabase.rpc("academy2_create_course", {p_headquarters_id: headquartersId,p_creation_id: creationId,p_input: row});
  if (error) throw courseError(error, 'save');
  return data as Academy2Course;
}
