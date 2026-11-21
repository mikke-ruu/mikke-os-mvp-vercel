import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { createMikkeMenuAuthScope, runWithMikkeMenuLease } from "./menu-preferences-auth-scope";
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

const authScope = createMikkeMenuAuthScope();
let authReady: Promise<void> | undefined;

function initializeMenuAuthScope() {
  if (!authReady) {
    // 同一タブで1つだけ購読を保ち、A→B→Aも単調なepochで検出する。
    authReady = new Promise<void>((resolve) => {
      supabase.auth.onAuthStateChange((event, session) => {
        authScope.observe(session);
        if (event === "INITIAL_SESSION") resolve();
      });
    });
  }
  return authReady;
}

async function withMenuActor<T>(expectedActor: string, operation: (client: SupabaseClient) => Promise<T>): Promise<T> {
  await initializeMenuAuthScope();
  const lease = authScope.capture(expectedActor);
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      accessToken: async () => lease.accessToken(),
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    }
  );
  return runWithMikkeMenuLease(lease, () => operation(client));
}

async function readPreferences(client: SupabaseClient): Promise<MikkeMenuPreferenceRow[]> {
  const { data, error } = await client.rpc(MIKKE_MENU_PREFERENCES_RPC.getMine);
  if (error) throw error;
  return normalizeMikkeMenuPreferenceRows(data);
}

/** Manager設定UI向け。DB/RPC未適用時はrejectし、表示hook側が標準順へfallbackする。 */
export async function getMyMikkeMenuPreferences(expectedActor: string): Promise<MikkeMenuPreferenceRow[]> {
  return withMenuActor(expectedActor, readPreferences);
}

/** DB契約のjsonb引数名は p_items に固定する。 */
export async function replaceMyMikkeMenuPreferences(
  draft: MikkeMenuPreferenceDraft,
  expectedActor: string
): Promise<MikkeMenuPreferenceRow[]> {
  const preferences = menuPreferenceRowsFromDraft(draft);
  return withMenuActor(expectedActor, async (client) => {
    const { error } = await client.rpc(
      MIKKE_MENU_PREFERENCES_RPC.replaceMine,
      menuPreferenceReplaceArguments(preferences)
    );
    if (error) throw error;
    return readPreferences(client);
  });
}

export async function resetMyMikkeMenuPreferences(expectedActor: string): Promise<void> {
  return withMenuActor(expectedActor, async (client) => {
    const { error } = await client.rpc(MIKKE_MENU_PREFERENCES_RPC.resetMine);
    if (error) throw error;
  });
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
