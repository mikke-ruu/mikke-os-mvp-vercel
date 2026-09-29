import { supabase } from '@/lib/supabase/client';
import { assertAcademyWritable } from '@/lib/academy/preview';
import type { Academy2Course } from './courses';
import type { Academy2CourseMaterials } from './course-materials';
import type { AcademyPageBlock } from '@/types/database';

export type CourseEditorSettings = { targetAudience: string; showIntroduction: boolean; sampleName: string };
export type CourseEditorDocument = { course: Academy2Course; materials: Academy2CourseMaterials; settings: CourseEditorSettings };
export type CourseEditorInput = { name: string; subtitle: string; main_image_url: string; description: string; duration_text: string; code?: string };
export type CourseEditorSave = { requestId: string; courseId: string | null; expectedUpdatedAt: string | null; materialRevision: number; legacyUpdatedAt: string | null; basic: CourseEditorInput; settings: CourseEditorSettings; blocks: AcademyPageBlock[] };
function editorError(error: { code?: string }): Error {
  if (error.code === '42501') return new Error('この講座を確認・変更する権限がありません。');
  if (error.code === 'PT409') return new Error('別の変更が保存されています。入力内容を控えてから、最新の内容を読み直してください。');
  if (error.code === '22023') return new Error('講座名と教材などの入力内容を確認してください。');
  return new Error('講座の保存・取得を確認できませんでした。入力内容は残っています。');
}
export async function getCourseEditor(headquartersId: string, courseId: string): Promise<CourseEditorDocument> {
  const { data, error } = await supabase.rpc('academy2_course_editor', { p_headquarters_id: headquartersId, p_course_id: courseId });
  if (error) throw Object.assign(editorError(error), { code: error.code });
  return data as CourseEditorDocument;
}
export async function saveCourseEditor(headquartersId: string, input: CourseEditorSave): Promise<CourseEditorDocument> {
  assertAcademyWritable();
  const { data, error } = await supabase.rpc('academy2_save_course_editor', {
    p_headquarters_id: headquartersId, p_request_id: input.requestId, p_course_id: input.courseId,
    p_expected_updated_at: input.expectedUpdatedAt, p_material_revision: input.materialRevision,
    p_legacy_updated_at: input.legacyUpdatedAt, p_basic: input.basic, p_editor: input.settings, p_blocks: input.blocks,
  });
  if (error) throw editorError(error);
  return data as CourseEditorDocument;
}
