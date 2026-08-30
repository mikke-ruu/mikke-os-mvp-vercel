import { supabase } from "@/lib/supabase/client";
import {
  academyPreviewProgram,
  academyPreviewSections,
  assertAcademyWritable,
  isAcademyLocalReview
} from "@/lib/academy/preview";
import type {
  AcademyProgram,
  AcademyProgramSection,
  AcademyProgramStep,
  AcademyProgramStepType
} from "@/types/database";

export type AcademyProgramSectionWithSteps = AcademyProgramSection & {
  steps: AcademyProgramStep[];
};

export async function getCourseProgram(headquartersId: string, courseId: string) {
  if (isAcademyLocalReview()) return courseId === academyPreviewProgram.course_id ? academyPreviewProgram : null;
  const { data, error } = await supabase
    .from("academy_programs")
    .select("*")
    .eq("headquarters_id", headquartersId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as AcademyProgram | null;
}

export async function createCourseProgram(headquartersId: string, courseId: string, title: string) {
  assertAcademyWritable();
  const { data, error } = await supabase
    .from("academy_programs")
    .insert({ headquarters_id: headquartersId, course_id: courseId, title: title.trim(), status: "draft" })
    .select("*")
    .single();
  if (error) throw error;
  return data as AcademyProgram;
}

export async function listProgramSections(programId: string): Promise<AcademyProgramSectionWithSteps[]> {
  if (isAcademyLocalReview()) return academyPreviewSections;
  const { data, error } = await supabase
    .from("academy_program_sections")
    .select("*, steps:academy_program_steps(*)")
    .eq("program_id", programId)
    .order("sort_order");
  if (error) throw error;
  return ((data ?? []) as AcademyProgramSectionWithSteps[]).map((section) => ({
    ...section,
    steps: [...(section.steps ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  }));
}

export async function createProgramSection(programId: string, title: string, sortOrder: number) {
  assertAcademyWritable();
  const { data, error } = await supabase
    .from("academy_program_sections")
    .insert({ program_id: programId, title: title.trim(), sort_order: sortOrder })
    .select("*")
    .single();
  if (error) throw error;
  return data as AcademyProgramSection;
}

export async function createProgramStep(
  sectionId: string,
  input: { title: string; completionGuide: string; type: AcademyProgramStepType; sortOrder: number }
) {
  assertAcademyWritable();
  const { data, error } = await supabase
    .from("academy_program_steps")
    .insert({
      section_id: sectionId,
      title: input.title.trim(),
      content: input.completionGuide.trim() || null,
      step_type: input.type,
      sort_order: input.sortOrder,
      requires_previous: true,
      self_completion_allowed: input.type !== "approval"
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as AcademyProgramStep;
}

export async function updateProgramStep(
  stepId: string,
  input: { title: string; completionGuide: string; type: AcademyProgramStepType }
) {
  assertAcademyWritable();
  const { data, error } = await supabase
    .from("academy_program_steps")
    .update({
      title: input.title.trim(),
      content: input.completionGuide.trim() || null,
      step_type: input.type,
      self_completion_allowed: input.type !== "approval"
    })
    .eq("id", stepId)
    .select("*")
    .single();
  if (error) throw error;
  return data as AcademyProgramStep;
}

export async function deleteProgramStep(stepId: string) {
  assertAcademyWritable();
  const { error } = await supabase.from("academy_program_steps").delete().eq("id", stepId);
  if (error) throw error;
}

export async function publishCourseProgram(programId: string) {
  assertAcademyWritable();
  const { data, error } = await supabase.rpc("academy_publish_program_version", {
    p_program_id: programId
  });
  if (error) throw error;
  return data as string;
}
