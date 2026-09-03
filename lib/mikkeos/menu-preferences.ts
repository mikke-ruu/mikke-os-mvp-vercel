import { supabase } from "@/lib/supabase/client";
import {
  MIKKE_MENU_PREFERENCES_RPC,
  menuPreferenceReplaceArguments,
  menuPreferenceRowsFromDraft,
  normalizeMikkeMenuPreferenceRows,
  type MikkeMenuPreferenceDraft,
  type MikkeMenuPreferenceRow
} from "./menu-preferences-model";

export const MIKKE_GUEST_MENU_PREFERENCES_KEY = "mikke.menu.preferences.guest.v1";
export const MIKKE_GUEST_MENU_PREFERENCES_EVENT = "mikke:menu-preferences-updated";

/** Manager設定UI向け。DB/RPC未適用時はrejectし、表示hook側が標準順へfallbackする。 */
export async function getMyMikkeMenuPreferences(): Promise<MikkeMenuPreferenceRow[]> {
  const { data, error } = await supabase.rpc(MIKKE_MENU_PREFERENCES_RPC.getMine);
  if (error) throw error;
  return normalizeMikkeMenuPreferenceRows(data);
}

/** DB契約のjsonb引数名は p_items に固定する。 */
export async function replaceMyMikkeMenuPreferences(
  draft: MikkeMenuPreferenceDraft
): Promise<MikkeMenuPreferenceRow[]> {
  const preferences = menuPreferenceRowsFromDraft(draft);
  const { error } = await supabase.rpc(
    MIKKE_MENU_PREFERENCES_RPC.replaceMine,
    menuPreferenceReplaceArguments(preferences)
  );
  if (error) throw error;
  return getMyMikkeMenuPreferences();
}

export async function resetMyMikkeMenuPreferences(): Promise<void> {
  const { error } = await supabase.rpc(MIKKE_MENU_PREFERENCES_RPC.resetMine);
  if (error) throw error;
}

export function getGuestMikkeMenuPreferences(): MikkeMenuPreferenceRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MIKKE_GUEST_MENU_PREFERENCES_KEY);
    return raw ? normalizeMikkeMenuPreferenceRows(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function replaceGuestMikkeMenuPreferences(draft: MikkeMenuPreferenceDraft): MikkeMenuPreferenceRow[] {
  const preferences = menuPreferenceRowsFromDraft(draft);
  if (typeof window === "undefined") return preferences;
  window.localStorage.setItem(MIKKE_GUEST_MENU_PREFERENCES_KEY, JSON.stringify(preferences));
  window.dispatchEvent(new CustomEvent(MIKKE_GUEST_MENU_PREFERENCES_EVENT));
  return preferences;
}

export function resetGuestMikkeMenuPreferences(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(MIKKE_GUEST_MENU_PREFERENCES_KEY);
  window.dispatchEvent(new CustomEvent(MIKKE_GUEST_MENU_PREFERENCES_EVENT));
}
