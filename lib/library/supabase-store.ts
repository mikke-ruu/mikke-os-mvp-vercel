import { supabase } from "@/lib/supabase/client";
import type { LibraryStoreState } from "./types";
import { normalizeLibraryState } from "./store";

type LibraryUserStoreRow = {
  state: unknown;
};

export async function loadLibraryCloudStore(userId: string): Promise<LibraryStoreState | null> {
  const { data, error } = await supabase
    .from("library_user_stores")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle<LibraryUserStoreRow>();

  if (error) throw error;
  if (!data?.state) return null;
  return normalizeLibraryState(data.state as LibraryStoreState);
}

export async function saveLibraryCloudStore(userId: string, state: LibraryStoreState) {
  const { error } = await supabase
    .from("library_user_stores")
    .upsert(
      {
        user_id: userId,
        state: normalizeLibraryState(state),
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    );

  if (error) throw error;
}
