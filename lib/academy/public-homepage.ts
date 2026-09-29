import { academyPublicClient } from "./public-client";
import type { AcademyCourse, AcademyHeadquarters, AcademyInstructor } from "@/types/database";

export type PublicHomepage = {
  headquarters: Pick<AcademyHeadquarters, "id" | "name" | "handle" | "tagline" | "front_message" | "hero_image_url" | "front_blocks" | "contact_email">;
  courses: Pick<AcademyCourse, "id" | "code" | "name" | "subtitle" | "main_image_url" | "price" | "duration_text">[];
  instructors: Pick<AcademyInstructor, "id" | "business_name" | "area" | "photo_url" | "online_available">[];
};

export async function getPublicHomepage(handle: string): Promise<PublicHomepage | null> {
  const { data, error } = await academyPublicClient.rpc("academy_get_public_homepage", { p_handle: handle }).abortSignal(AbortSignal.timeout(30000));
  if (error) throw error;
  return data as PublicHomepage | null;
}
