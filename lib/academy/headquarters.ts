import { supabase } from "@/lib/supabase/client";
import type { AcademyHeadquarters, AcademyLpBlock, Profile } from "@/types/database";

// 現在のユーザーがオーナーの本部（MVPは1件想定）。
export async function getOwnedHeadquarters(userId: string) {
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

// 本部が未登録なら1件作る（初期導入時の枠作成に相当）。
export async function ensureHeadquarters(profile: Profile, name: string) {
  const existing = await getOwnedHeadquarters(profile.user_id);
  if (existing) return existing;

  const handleBase = (profile.handle || "hq").toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 24);
  const { data, error } = await supabase
    .from("academy_headquarters")
    .insert({
      owner_user_id: profile.user_id,
      owner_profile_id: profile.id,
      name,
      handle: `${handleBase}-academy`.slice(0, 30),
      plan: "small"
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as AcademyHeadquarters;
}
