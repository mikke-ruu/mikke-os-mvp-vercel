import { academyPublicClient } from "./public-client";
import { listPublicOfferings, type PublicOfferingSummary } from "./public-offerings";
import type { AcademyCourse, AcademyHeadquarters, AcademyInstructor } from "@/types/database";

export type PublicHomepage = {
  mode?: "academy2";
  headquarters: Pick<AcademyHeadquarters, "id" | "name" | "handle" | "tagline" | "front_message" | "hero_image_url" | "front_blocks" | "contact_email">;
  courses: Pick<AcademyCourse, "id" | "code" | "name" | "subtitle" | "main_image_url" | "price" | "duration_text">[];
  instructors: Pick<AcademyInstructor, "id" | "business_name" | "area" | "photo_url" | "online_available">[];
  offerings: PublicOfferingSummary[] | null;
};

// Use installed public reads; no dependency on the absent homepage RPC.
// The public-availability helper and existing RLS retain payment/publication gates.
export async function getPublicHomepage(handle: string): Promise<PublicHomepage | null> {
  return readPublicHomepage(handle,true);
}
async function readPublicHomepage(handle:string,resolveAlias:boolean):Promise<PublicHomepage|null>{
  const normalized = handle.trim().toLowerCase();
  if (!normalized) return null;
  const signal = AbortSignal.timeout(30000);
  const { data: v2, error: v2Error } = await academyPublicClient.rpc("academy2_public_homepage", { p_handle: normalized }).abortSignal(signal);
  if (v2Error && !["PGRST202","42883"].includes(v2Error.code)) throw v2Error;
  if (!v2Error) {
    if (v2 === null) {
      if(!resolveAlias)return null;
      const {data:canonical,error:aliasError}=await academyPublicClient.rpc('academy2_resolve_homepage_url',{p_handle:normalized}).abortSignal(AbortSignal.timeout(30000));
      // Older installations have no alias resolver; preserve their existing raw-handle contract.
      if(aliasError){if(['PGRST202','42883'].includes(aliasError.code))return null;throw aliasError;}
      if(canonical===null)return null;
      if(typeof canonical!=='string'||!canonical||canonical!==canonical.trim().toLowerCase()||canonical===normalized||canonical.length>100)throw new Error('invalid_public_homepage_alias');
      return readPublicHomepage(canonical,false);
    }
    if (v2?.mode === "academy2" && v2.headquarters?.handle === normalized && Array.isArray(v2.courses) && Array.isArray(v2.instructors)) return v2 as PublicHomepage;
    if (v2?.mode !== "legacy") throw new Error("invalid_public_homepage");
  }
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
  const offeringsPromise = listPublicOfferings({ headquartersId: headquarters.id }).catch(() => null);
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
  // A failed service-list request must not hide the entire public homepage.
  const offerings = await offeringsPromise;
  return { headquarters: headquarters as PublicHomepage["headquarters"], courses: publicCourses, instructors, offerings };
}
