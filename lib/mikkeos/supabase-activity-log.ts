import { getProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase/client";
import { toSupabaseActivityLogInsert, type SupabaseActivityLogInsert } from "./activity-adapter";
import type { UnifiedActivityLog } from "./types";

const activityLogSelect =
  "id,source_service,source_record_id,activity_type,visibility,display_on_story,has_financial_value,transaction_type,payment_status";

export type SupabaseActivityLogSaveResult = {
  id: string;
  sourceService: string;
  sourceRecordId: string;
  activityType: string;
};

export async function saveUnifiedActivityLogToSupabase(log: UnifiedActivityLog): Promise<SupabaseActivityLogSaveResult> {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) throw new Error("Supabase Activity Log保存にはログインが必要です。");

  const profile = await getProfile(session.user.id);
  if (!profile) throw new Error("Supabase Activity Log保存にはMikke IDプロフィールが必要です。");

  const payload = toSupabaseActivityLogInsert(log, {
    userId: session.user.id,
    profileId: profile.id
  });

  const { data, error } = await supabase
    .from("activity_logs")
    .upsert(payload, { onConflict: "profile_id,source_service,source_record_id" })
    .select(activityLogSelect)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Supabase Activity Log保存後の確認行を取得できませんでした。");

  const row = data as Pick<SupabaseActivityLogInsert, "source_service" | "source_record_id" | "activity_type"> & { id: string };
  return {
    id: row.id,
    sourceService: row.source_service,
    sourceRecordId: row.source_record_id,
    activityType: row.activity_type
  };
}
