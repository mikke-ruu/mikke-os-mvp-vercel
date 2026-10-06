import { academyPublicClient } from "./public-client";
import type { AcademyCourse, AcademyHeadquarters, AcademyInstructor } from "@/types/database";

export type PublicHomepage = {
  headquarters: Pick<AcademyHeadquarters, "id" | "name" | "handle" | "tagline" | "front_message" | "hero_image_url" | "front_blocks" | "contact_email">;
  courses: Pick<AcademyCourse, "id" | "code" | "name" | "subtitle" | "main_image_url" | "price" | "duration_text">[];
  instructors: Pick<AcademyInstructor, "id" | "business_name" | "area" | "photo_url" | "online_available">[];
};

export async function getPublicHomepage(handle: string): Promise<PublicHomepage | null> {
  const normalized = handle.trim().toLowerCase();
  if (!normalized) return null;
  const signal = AbortSignal.timeout(30000);
  const { data: headquarters, error: headquartersError } = await academyPublicClient
    .from("academy_headquarters")
    .select("id,name,handle,tagline,front_message,hero_image_url,front_blocks,contact_email")
    .eq("handle", normalized).eq("is_active", true).abortSignal(signal).maybeSingle();
  if (headquartersError) throw headquartersError;
  if (!headquarters) return null;
  const { data: available, error: availabilityError } = await academyPublicClient
    .rpc("academy_is_publicly_available", { p_headquarters_id: headquarters.id }).abortSignal(signal);
  if (availabilityError) throw availabilityError;
  if (available !== true) return null;
  const { data: courses, error: courseError } = await academyPublicClient
    .from("academy_courses")
    .select("id,code,name,subtitle,main_image_url,price,duration_text")
    .eq("headquarters_id", headquarters.id).eq("is_published", true)
    .order("sort_order", { ascending: true }).order("created_at", { ascending: true }).abortSignal(signal);
  if (courseError) throw courseError;
  const publicCourses = (courses ?? []) as PublicHomepage["courses"];
  let instructors: PublicHomepage["instructors"] = [];
  if (publicCourses.length) {
    const { data, error } = await academyPublicClient.from("academy_instructors")
      .select("id,business_name,area,photo_url,online_available")
      .eq("headquarters_id", headquarters.id).eq("registration_status", "registered")
      .eq("is_listed", true).eq("is_active", true).in("course_id", publicCourses.map(course => course.id))
      .order("created_at", { ascending: true }).abortSignal(signal);
    if (error) throw error;
    instructors = (data ?? []) as PublicHomepage["instructors"];
  }
  return { headquarters: headquarters as PublicHomepage["headquarters"], courses: publicCourses, instructors };
}
