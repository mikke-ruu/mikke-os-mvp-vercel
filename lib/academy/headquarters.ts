import { supabase } from "@/lib/supabase/client";
import { getAcademyRouteContext, listMyAcademyContexts } from "@/lib/academy/access-context";
import type { AcademyHeadquarters, AcademyLpBlock } from "@/types/database";

// 現在のユーザーがオーナーの本部（MVPは1件想定）。
export async function getOwnedHeadquarters(userId: string, academyId?: string) {
  const explicitAcademyId = academyId ?? getAcademyRouteContext()?.academyId;
  if (explicitAcademyId) {
    const contexts = await listMyAcademyContexts();
    const context = contexts.find((candidate) => candidate.academy_id === explicitAcademyId);
    if (!context?.portals.includes("manage")) return null;

    const { data, error } = await supabase
      .from("academy_headquarters")
      .select("*")
      .eq("id", explicitAcademyId)
      .maybeSingle();
    if (error) throw error;
    return (data as AcademyHeadquarters | null) ?? null;
  }

  const { data, error } = await supabase
    .from("academy_headquarters")
    .select("*")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as AcademyHeadquarters;

  const { data: manageable, error: manageableError } = await supabase.rpc(
    "academy_get_my_manageable_headquarters"
  );
  if (manageableError) {
    if (manageableError.code === "PGRST202" || manageableError.code === "42883") return null;
    throw manageableError;
  }
  return ((manageable as AcademyHeadquarters[] | null) ?? [])[0] ?? null;
}

// 本部情報の更新（フロントページ編集用）
export async function updateHeadquarters(
  hqId: string,
  patch: Partial<{
    name: string;
    tagline: string | null;
    front_message: string | null;
    hero_image_url: string | null;
    logo_url: string | null;
    contact_email: string | null;
    default_payment_note: string | null;
    main_color: string | null;
    renewal_period_months: number | null;
    next_instructor_number: number | null;
    // Wave F (AC-F3): フロントページのブロックビルダー
    front_blocks: AcademyLpBlock[];
  }>
) {
  const { data, error } = await supabase.rpc("academy_update_headquarters_profile", {
    p_headquarters_id: hqId,
    p_patch: patch
  });

  if (error) throw error;
  return data as AcademyHeadquarters;
}

// 契約確認済みの作成権を1件消費して本部を作る。直接INSERTはDB側で禁止する。
export async function createHeadquarters(name: string) {
  const { data, error } = await supabase.rpc("academy_create_headquarters", {
    p_name: name
  });

  if (error) throw error;
  return data as AcademyHeadquarters;
}
