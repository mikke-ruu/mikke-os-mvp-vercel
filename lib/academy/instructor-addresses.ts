import { supabase } from "@/lib/supabase/client";
import type { AcademyInstructorAddress } from "@/types/database";

// Wave E (AC-E1): 講師の配送先住所帳。
// 対面(in_person)講座のキット送り先を、講師が自分の職場・レンタルサロン等を含めて
// 複数（自宅に限定しない）事前登録しておける仕組み。RLSは講師本人（instructor_id経由）のみ操作可を想定。
export const MAX_INSTRUCTOR_ADDRESSES = 5;

export async function listInstructorAddresses(instructorId: string) {
  const { data, error } = await supabase
    .from("academy_instructor_addresses")
    .select("*")
    .eq("instructor_id", instructorId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AcademyInstructorAddress[];
}

export async function createInstructorAddress(instructorId: string, label: string, addressText: string) {
  const { data, error } = await supabase
    .from("academy_instructor_addresses")
    .insert({
      instructor_id: instructorId,
      label: label.trim(),
      address_text: addressText.trim()
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as AcademyInstructorAddress;
}

export async function deleteInstructorAddress(instructorId: string, addressId: string) {
  const { error } = await supabase
    .from("academy_instructor_addresses")
    .delete()
    .eq("id", addressId)
    .eq("instructor_id", instructorId);
  if (error) throw error;
}
