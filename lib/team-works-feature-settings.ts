import type { SupabaseClient } from "@supabase/supabase-js";

// Team Works: プロジェクト単位の「機能ON/OFF」設定(Phase L)。
// team_works_projects.feature_settingsがnull(既存行は全てnull)の場合はDEFAULTを使う。
// この既定値は全機能ONであり、未設定のプロジェクト(アリサ含む)の表示・動作は
// 一切変わらない。運営型・納品型でキーの構成が異なるため型を分けるが、列は共用する
// (docs/MIKKEOS_TEAM_WORKS_GENERALIZE_PLAN_2026-07-30.md §4)。
//
// RLSとは独立。これは表示の設定であって権限の設定ではない。
export type TeamWorksOperationsFeatureSettings = {
  roster: boolean; // 名簿(参加者・グループ)
  attendance: boolean; // 出席(コマの名簿・出席記録)
  shifts: boolean; // 希望シフト(パートナーの提出・本部承認)
  reports: boolean; // 報告
  manuals: boolean; // マニュアル
  lessons: boolean; // ポータルのレッスン画面(コマ表示・Zoom)
};

export const DEFAULT_OPERATIONS_FEATURE_SETTINGS: TeamWorksOperationsFeatureSettings = {
  roster: true,
  attendance: true,
  shifts: true,
  reports: true,
  manuals: true,
  lessons: true
};

// attendanceはrosterに依存する(名簿が無ければ出席も取れない)。
// UIでは「名簿をOFFにすると出席もOFFになります」と表示すること。
export function resolveOperationsFeatureSettings(
  overrides: Partial<TeamWorksOperationsFeatureSettings> | null | undefined
): TeamWorksOperationsFeatureSettings {
  const resolved = { ...DEFAULT_OPERATIONS_FEATURE_SETTINGS, ...(overrides ?? {}) };
  if (!resolved.roster) resolved.attendance = false;
  return resolved;
}

// 納品型には名簿・シフトが無いため項目は別立て。
// clientPortal(クライアントポータル全体)は既存のclient_visible列と意味が重複するため、
// feature_settingsには含めない(既存列を正とする。§L-4の注記どおり)。
export type TeamWorksDeliveryFeatureSettings = {
  materials: boolean; // 資料(J-5で新設)
  forms: boolean; // 提出フォーム
  clientReview: boolean; // クライアント確認(承認・差し戻し)
  messages: boolean; // メッセージ(K-1)
};

export const DEFAULT_DELIVERY_FEATURE_SETTINGS: TeamWorksDeliveryFeatureSettings = {
  materials: true,
  forms: true,
  clientReview: true,
  messages: true
};

export function resolveDeliveryFeatureSettings(
  overrides: Partial<TeamWorksDeliveryFeatureSettings> | null | undefined
): TeamWorksDeliveryFeatureSettings {
  return { ...DEFAULT_DELIVERY_FEATURE_SETTINGS, ...(overrides ?? {}) };
}

// 運営型・納品型共通。feature_settingsをまるごと置き換える
// (「機能とポータルの設定」タブの保存ボタンから呼ぶ)。
export async function updateProjectFeatureSettings(
  client: SupabaseClient,
  projectId: string,
  settings: TeamWorksOperationsFeatureSettings | TeamWorksDeliveryFeatureSettings
): Promise<void> {
  const { data, error } = await client
    .from("team_works_projects")
    .update({ feature_settings: settings, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("機能設定を保存できませんでした。権限とプロジェクトを確認してください。");
}
