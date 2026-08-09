import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

function createRandomHandle() {
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `user_${random}`;
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}

export async function ensureProfile(user: User) {
  const existing = await getProfile(user.id);
  if (existing) return existing;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        user_id: user.id,
        display_name: "mikkeユーザー",
        handle: createRandomHandle(),
        bio: "",
        area: ""
      })
      .select("*")
      .single();

    if (!error) return data as Profile;
    if (error.code !== "23505") throw error;
  }
  throw new Error("mikke IDを準備できませんでした。もう一度お試しください。");
}
