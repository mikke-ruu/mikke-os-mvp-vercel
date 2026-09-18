import { supabase } from "@/lib/supabase/client";
import { assertAcademyWritable } from "@/lib/academy/preview";
import type { AcademyOffering } from "./offerings";
import type { LpBlock } from "@/components/mikkeos/page-builder/lp-design";

export type InstructorOfferingProfile = { display_name: string; bio: string; image_url: string; contact_email: string; application_note: string };
export type InstructorOfferingPage = {
  id: string; headquarters_id: string; offering_id: string; owner_user_id: string;
  profile: InstructorOfferingProfile; lp_blocks: LpBlock[]; status: "draft" | "published" | "archived";
};
export async function listEligibleInstructorOfferings() {
  const { data, error } = await supabase.rpc("academy_list_eligible_instructor_offerings");
  if (error) throw error;
  return (data ?? []) as AcademyOffering[];
}
export async function listMyOfferingPages(userId: string) {
  const { data, error } = await supabase.from("academy_instructor_offering_pages").select("*").eq("owner_user_id", userId);
  if (error) throw error;
  return (data ?? []) as InstructorOfferingPage[];
}
export async function saveInstructorOfferingPage(page: Pick<InstructorOfferingPage, "offering_id" | "profile" | "lp_blocks" | "status"> & { id?: string }) {
  assertAcademyWritable();
  const { data, error } = await supabase.rpc("academy_save_instructor_offering_page", {
    p_id: page.id ?? null, p_offering_id: page.offering_id, p_profile: page.profile, p_lp_blocks: page.lp_blocks, p_status: page.status
  });
  if (error) throw error;
  return data as InstructorOfferingPage;
}
export async function offeringUsage(headquartersId: string) {
  const { data, error } = await supabase.from("academy_instructor_offering_pages").select("offering_id,status").eq("headquarters_id", headquartersId).neq("status", "archived");
  if (error) throw error;
  return (data ?? []).reduce<Record<string, number>>((counts, row) => { counts[row.offering_id] = (counts[row.offering_id] ?? 0) + 1; return counts; }, {});
}
