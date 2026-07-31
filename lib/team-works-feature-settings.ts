import type { SupabaseClient } from "@supabase/supabase-js";

// Team Works: プロジェクト単位の「機能ON/OFF」設定(Phase L)。
// team_works_projects.feature_settingsがnull(既存行は全てnull)の場合はDEFAULTを使う。
// この既定値は全機能ONであり、未設定のプロジェクト(アリサ含む)の表示・動作は
// 一切変わらない。運営型・納品型でキーの構成が異なるため型を分けるが、列は共用する
// (docs/MIKKEOS_TEAM_WORKS_GENERALIZE_PLAN_2026-07-30.md §4)。
//
// RLSとは独立。これは表示の設定であって権限の設定ではない。
// 作業窓(N-2・2026-07-31): スタッフがコマを開いたときの画面(現行の「レッスン
// コンソール」)を部品単位でON/OFFできるようにしたもの。業種によって
// Zoomを使わない・タイムカード式にしたい等、必要な部品が変わるため。
// 全項目デフォルトtrue=アリサの現行レッスンコンソールと完全一致。
// (timerは計画書では新機能としてデフォルトfalse想定だったが、実装時に
// レッスンコンソールへ既存の生徒ごとの目安タイマーが既に常時表示されている
// ことが判明したため、そちらをON/OFFする項目として再利用する。既存動作を
// 変えないためデフォルトtrueに修正した。)
export type TeamWorksWorkWindowSettings = {
  zoom: boolean; // Zoom情報の表示・変更
  presence: boolean; // 開始/終了ボタン(プレゼンス通知)
  timer: boolean; // 生徒ごとの目安タイマー表示
  roster: boolean; // クライアントタスク(名簿・生徒送り)。attendance=falseなら強制false
  manualLink: boolean; // 名簿とマニュアルの連動表示。manuals=falseなら強制false
};

export const DEFAULT_WORK_WINDOW_SETTINGS: TeamWorksWorkWindowSettings = {
  zoom: true,
  presence: true,
  timer: true,
  roster: true,
  manualLink: true
};

export type TeamWorksOperationsFeatureSettings = {
  roster: boolean; // 名簿(参加者・グループ)
  attendance: boolean; // 出席(コマの名簿・出席記録)
  shifts: boolean; // 希望シフト(パートナーの提出・本部承認)
  reports: boolean; // 報告
  manuals: boolean; // マニュアル
  // クライアントポータルのカレンダー表示。N-1(2026-07-31)でスタッフ側の
  // スケジュール表示(予定そのもの)からは切り離した。予定は本部が組む以上、
  // スタッフには常に見える必要があるため(=lessons=falseでもスタッフの
  // スケジュールは消えない)。スタッフ側の「レッスン画面(作業窓)」の中身は
  // workWindowで別途制御する。
  lessons: boolean;
  workWindow: TeamWorksWorkWindowSettings;
};

export const DEFAULT_OPERATIONS_FEATURE_SETTINGS: TeamWorksOperationsFeatureSettings = {
  roster: true,
  attendance: true,
  shifts: true,
  reports: true,
  manuals: true,
  lessons: true,
  workWindow: DEFAULT_WORK_WINDOW_SETTINGS
};

// attendanceはrosterに依存する(名簿が無ければ出席も取れない)。
// UIでは「名簿をOFFにすると出席もOFFになります」と表示すること。
// workWindowはjsonbの入れ子のため、浅いスプレッドだけでは部分保存時に
// 残りの部品が消えてしまう。DEFAULTとの深いマージをここで行う。
export function resolveOperationsFeatureSettings(
  overrides: Partial<TeamWorksOperationsFeatureSettings> | null | undefined
): TeamWorksOperationsFeatureSettings {
  const resolved = { ...DEFAULT_OPERATIONS_FEATURE_SETTINGS, ...(overrides ?? {}) };
  const workWindow = { ...DEFAULT_WORK_WINDOW_SETTINGS, ...(overrides?.workWindow ?? {}) };
  if (!resolved.roster) resolved.attendance = false;
  if (!resolved.attendance) workWindow.roster = false;
  if (!resolved.manuals) workWindow.manualLink = false;
  resolved.workWindow = workWindow;
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
