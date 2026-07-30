import type { SupabaseClient } from "@supabase/supabase-js";

// UI上に表示する呼び名だけを差し替える設定。役割の実体(worker/client_user)は
// DBのroleカラムのまま変わらない。キーを増やす時はDEFAULT_LABELSと
// GENERAL_PURPOSE_LABELSの両方に足すこと。
export type TeamWorksLabels = {
  workers: string;
  holidayLabel: string;
};

// 既存組織(label_settingsがnullの行)向けフォールバック。
// アリサの組織を含む全既存行がこの値を引き続き表示する。
export const DEFAULT_LABELS: TeamWorksLabels = {
  workers: "パートナー",
  holidayLabel: "休校"
};

// 新規組織の作成経路が明示的に書き込む一般用の初期値。
export const GENERAL_PURPOSE_LABELS: TeamWorksLabels = {
  workers: "スタッフ",
  holidayLabel: "休校"
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

// 企業設定ページの「表示ラベル設定」から呼ぶ。label_settingsをまるごと置き換える
// (部分キーの保存はせず、常にresolve済みの完全な形で書き込む)。
export async function updateTeamWorksLabels(
  client: SupabaseClient,
  organizationId: string,
  labels: TeamWorksLabels
): Promise<void> {
  const { data, error } = await client
    .from("team_works_organizations")
    .update({ label_settings: labels, updated_at: new Date().toISOString() })
    .eq("id", organizationId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("表示ラベル設定を保存できませんでした。オーナー権限を確認してください。");
}
