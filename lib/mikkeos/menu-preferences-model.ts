export const MIKKE_MENU_APP_KEYS = ["marketnote", "story", "community", "ninteikoza"] as const;

export const MIKKE_MENU_PREFERENCES_RPC = {
  getMine: "mikke_app_menu_preferences_get_mine",
  replaceMine: "mikke_app_menu_preferences_replace_mine",
  replaceItemsArgument: "p_items",
  resetMine: "mikke_app_menu_preferences_reset_mine"
} as const;

export type MikkeMenuAppKey = (typeof MIKKE_MENU_APP_KEYS)[number];

export type MikkeMenuPreferenceRow = {
  app_key: MikkeMenuAppKey;
  sort_order: number;
  is_hidden: boolean;
};

export type MikkeMenuPreferenceDraft = {
  orderedAppKeys: MikkeMenuAppKey[];
  hiddenAppKeys: MikkeMenuAppKey[];
};

export type MikkeMenuProjection = {
  ownedAppKeys: MikkeMenuAppKey[];
  visibleOwnedAppKeys: MikkeMenuAppKey[];
  hiddenOwnedAppKeys: MikkeMenuAppKey[];
};

export function isMikkeMenuAppKey(value: unknown): value is MikkeMenuAppKey {
  return typeof value === "string" && MIKKE_MENU_APP_KEYS.includes(value as MikkeMenuAppKey);
}

export function shouldIncludeGuestMarketNoteData(isGuest: boolean, hasGuestMarketNoteData: boolean): boolean {
  return isGuest && hasGuestMarketNoteData;
}

/**
 * RPC/localStorageは信頼せず、共通registryに存在する行だけを受け入れる。
 * この正規化は所有判定を行わない。所有判定後のprojectionだけに使う。
 */
export function normalizeMikkeMenuPreferenceRows(value: unknown): MikkeMenuPreferenceRow[] {
  if (!Array.isArray(value)) return [];

  const rowsByKey = new Map<MikkeMenuAppKey, MikkeMenuPreferenceRow>();
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const row = candidate as Record<string, unknown>;
    if (!isMikkeMenuAppKey(row.app_key)) continue;
    if (typeof row.sort_order !== "number" || !Number.isFinite(row.sort_order)) continue;
    if (typeof row.is_hidden !== "boolean") continue;
    rowsByKey.set(row.app_key, {
      app_key: row.app_key,
      sort_order: Math.max(0, Math.trunc(row.sort_order)),
      is_hidden: row.is_hidden
    });
  }

  return [...rowsByKey.values()];
}

/**
 * 先に確定した所有キーだけを並べ替え・非表示化する。
 * 設定にない新規owned appは共通registry順で末尾へ加える。
 */
export function projectMikkeMenuPreferences(
  ownedAppKeys: readonly MikkeMenuAppKey[],
  rawPreferences: unknown
): MikkeMenuProjection {
  const ownedSet = new Set<MikkeMenuAppKey>();
  for (const key of ownedAppKeys) {
    if (isMikkeMenuAppKey(key)) ownedSet.add(key);
  }

  const preferences = normalizeMikkeMenuPreferenceRows(rawPreferences)
    .filter((row) => ownedSet.has(row.app_key));
  const preferenceByKey = new Map(preferences.map((row) => [row.app_key, row]));
  const standardIndex = new Map(MIKKE_MENU_APP_KEYS.map((key, index) => [key, index]));
  const orderedOwnedKeys = [...ownedSet].sort((left, right) => {
    const leftPreference = preferenceByKey.get(left);
    const rightPreference = preferenceByKey.get(right);
    if (leftPreference && rightPreference) {
      return leftPreference.sort_order - rightPreference.sort_order
        || (standardIndex.get(left) ?? 0) - (standardIndex.get(right) ?? 0);
    }
    if (leftPreference) return -1;
    if (rightPreference) return 1;
    return (standardIndex.get(left) ?? 0) - (standardIndex.get(right) ?? 0);
  });

  const hiddenOwnedAppKeys = orderedOwnedKeys.filter((key) => preferenceByKey.get(key)?.is_hidden === true);
  const hiddenSet = new Set(hiddenOwnedAppKeys);

  return {
    ownedAppKeys: orderedOwnedKeys,
    visibleOwnedAppKeys: orderedOwnedKeys.filter((key) => !hiddenSet.has(key)),
    hiddenOwnedAppKeys
  };
}

export function menuPreferenceRowsFromDraft(draft: MikkeMenuPreferenceDraft): MikkeMenuPreferenceRow[] {
  const hiddenKeys = new Set(draft.hiddenAppKeys.filter(isMikkeMenuAppKey));
  const orderedKeys: MikkeMenuAppKey[] = [];
  const seen = new Set<MikkeMenuAppKey>();

  for (const key of draft.orderedAppKeys) {
    if (!isMikkeMenuAppKey(key) || seen.has(key)) continue;
    seen.add(key);
    orderedKeys.push(key);
  }

  return orderedKeys.map((app_key, sort_order) => ({
    app_key,
    sort_order,
    is_hidden: hiddenKeys.has(app_key)
  }));
}

export function menuPreferenceReplaceArguments(
  preferences: readonly MikkeMenuPreferenceRow[]
): { p_items: MikkeMenuPreferenceRow[] } {
  return { p_items: [...preferences] };
}
