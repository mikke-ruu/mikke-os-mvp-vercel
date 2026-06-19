import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

function normalizeHandle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 24);
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

  const emailPrefix = user.email?.split("@")[0] || "mikke";
  const handle = `${normalizeHandle(emailPrefix)}_${user.id.slice(0, 4)}`;
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      user_id: user.id,
      display_name: emailPrefix,
      handle,
      bio: "Mikke OSで活動を記録しています。",
      area: "オンライン"
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Profile;
}
