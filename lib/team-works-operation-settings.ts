import type { SupabaseClient } from "@supabase/supabase-js";
import { getJapanDayOff } from "@/lib/japanese-calendar";
import { DEFAULT_LABELS, resolveTeamWorksLabels, type TeamWorksLabels } from "@/lib/team-works-labels";

// 組織・プロジェクト共通で使う「休みの日」設定。
// 以前は土日祝がコマ登録不可という前提が全組織で固定されており(isJapanDayOffKey直呼び)、
// アリサの日本語レッスン業態がそのまま全組織のルールになっていた。ここを組織ごと・
// プロジェクトごとに変えられるようにする。
//
// operation_settingsがnull(既存行は全てnull)の場合はDEFAULT_OPERATION_SETTINGSを使う。
// この既定値は旧isJapanDayOffKeyと完全に同じ挙動(土日祝は休み)になるよう作ってあるため、
// 未設定の組織(アリサ含む)の判定結果は一切変わらない。
export type TeamWorksOperationSettings = {
  closedWeekdays: number[]; // 0=日〜6=土
  closeOnNationalHolidays: boolean;
};

export const DEFAULT_OPERATION_SETTINGS: TeamWorksOperationSettings = {
  closedWeekdays: [0, 6],
  closeOnNationalHolidays: true
};

export function resolveOperationSettings(overrides: Partial<TeamWorksOperationSettings> | null | undefined): TeamWorksOperationSettings {
  return { ...DEFAULT_OPERATION_SETTINGS, ...(overrides ?? {}) };
}

// プロジェクト側に明示的な上書きがあればそちらを優先し、無ければ組織設定、
// それも無ければデフォルトに落ちる。
export function resolveEffectiveOperationSettings(
  organizationOverrides: Partial<TeamWorksOperationSettings> | null | undefined,
  projectOverrides: Partial<TeamWorksOperationSettings> | null | undefined
): TeamWorksOperationSettings {
  if (projectOverrides) return resolveOperationSettings(projectOverrides);
  return resolveOperationSettings(organizationOverrides);
}

export function isClosedDayKey(settings: TeamWorksOperationSettings, dateKey: string): boolean {
  const date = new Date(`${dateKey}T00:00:00`);
  if (settings.closedWeekdays.includes(date.getDay())) return true;
  return settings.closeOnNationalHolidays && getJapanDayOff(date).isNationalHoliday;
}

// エラーメッセージ用の理由句。デフォルト設定(土日祝は休み)のときは既存の文言
// 「土日祝は」をそのまま使い、アリサを含む未設定組織のメッセージを1文字も変えない。
// カスタム設定の組織には汎用の言い回しを使う。
export function describeClosedDayReason(settings: TeamWorksOperationSettings, holidayLabel: string): string {
  const isDefaultWeekdays =
    settings.closeOnNationalHolidays
    && settings.closedWeekdays.length === 2
    && settings.closedWeekdays.includes(0)
    && settings.closedWeekdays.includes(6);
  const prefix = isDefaultWeekdays ? "土日祝は" : "設定された休みの日は";
  return `${prefix}${holidayLabel}日`;
}

export async function loadOrganizationOperationSettingsMap(
  client: SupabaseClient,
  organizationIds: string[]
): Promise<Map<string, TeamWorksOperationSettings>> {
  if (organizationIds.length === 0) return new Map();
  const { data, error } = await client
    .from("team_works_organizations")
    .select("id,operation_settings")
    .in("id", organizationIds);
  if (error || !data) return new Map();
  return new Map(
    (data as { id: string; operation_settings: Partial<TeamWorksOperationSettings> | null }[]).map((row) => [
      row.id,
      resolveOperationSettings(row.operation_settings)
    ])
  );
}

export async function loadOrganizationOperationSettings(
  client: SupabaseClient,
  organizationId: string
): Promise<TeamWorksOperationSettings> {
  const map = await loadOrganizationOperationSettingsMap(client, [organizationId]);
  return map.get(organizationId) ?? DEFAULT_OPERATION_SETTINGS;
}

// 企業設定ページの「休日設定」から呼ぶ。operation_settingsをまるごと置き換える。
export async function updateOrganizationOperationSettings(
  client: SupabaseClient,
  organizationId: string,
  settings: TeamWorksOperationSettings
): Promise<void> {
  const { data, error } = await client
    .from("team_works_organizations")
    .update({ operation_settings: settings, updated_at: new Date().toISOString() })
    .eq("id", organizationId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("休日設定を保存できませんでした。オーナー権限を確認してください。");
}

// プロジェクト作成・移動時の休日判定に使う。プロジェクト個別設定 ?? 組織設定 ?? デフォルト、
// の順で解決し、休日ラベル(組織の表示ラベル設定)も一緒に返す。
export async function loadProjectHolidayContext(
  client: SupabaseClient,
  projectId: string
): Promise<{ settings: TeamWorksOperationSettings; holidayLabel: string }> {
  const fallback = { settings: DEFAULT_OPERATION_SETTINGS, holidayLabel: DEFAULT_LABELS.holidayLabel };

  const { data: project, error: projectError } = await client
    .from("team_works_projects")
    .select("organization_id,operation_settings")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError || !project) return fallback;

  const { data: organization, error: organizationError } = await client
    .from("team_works_organizations")
    .select("operation_settings,label_settings")
    .eq("id", project.organization_id as string)
    .maybeSingle();

  const organizationSettings = organizationError || !organization
    ? null
    : (organization.operation_settings as Partial<TeamWorksOperationSettings> | null);
  const holidayLabel = organizationError || !organization
    ? DEFAULT_LABELS.holidayLabel
    : resolveTeamWorksLabels(organization.label_settings as Partial<TeamWorksLabels> | null).holidayLabel;

  const settings = resolveEffectiveOperationSettings(
    organizationSettings,
    project.operation_settings as Partial<TeamWorksOperationSettings> | null
  );
  return { settings, holidayLabel };
}
