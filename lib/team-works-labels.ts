import type { SupabaseClient } from "@supabase/supabase-js";

// UI上に表示する呼び名だけを差し替える設定。役割の実体(worker/client_user)は
// DBのroleカラムのまま変わらない。キーを増やす時はDEFAULT_LABELSと
// GENERAL_PURPOSE_LABELSの両方に足すこと。
export type TeamWorksLabels = {
  workers: string;
};

// 既存組織(label_settingsがnullの行)向けフォールバック。
// アリサの組織を含む全既存行がこの値を引き続き表示する。
export const DEFAULT_LABELS: TeamWorksLabels = {
  workers: "パートナー"
};

// 新規組織の作成経路が明示的に書き込む一般用の初期値。
export const GENERAL_PURPOSE_LABELS: TeamWorksLabels = {
  workers: "スタッフ"
};

export function resolveTeamWorksLabels(overrides: Partial<TeamWorksLabels> | null | undefined): TeamWorksLabels {
  return { ...DEFAULT_LABELS, ...(overrides ?? {}) };
}

export async function loadTeamWorksLabels(client: SupabaseClient, organizationId: string | null): Promise<TeamWorksLabels> {
  if (!organizationId) return DEFAULT_LABELS;
  const { data, error } = await client
    .from("team_works_organizations")
    .select("label_settings")
    .eq("id", organizationId)
    .maybeSingle();
  if (error || !data) return DEFAULT_LABELS;
  return resolveTeamWorksLabels(data.label_settings as Partial<TeamWorksLabels> | null);
}
