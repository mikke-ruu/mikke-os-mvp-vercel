"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MikkeOwnerMenuItem, MikkeOwnerMenuSuggestedApp } from "./MikkeOwnerMenu";
import { getGuestMarketNoteStats } from "@/lib/marketnote-guest";
import {
  MIKKE_GUEST_MENU_PREFERENCES_EVENT,
  MIKKE_GUEST_MENU_PREFERENCES_KEY,
  getGuestMikkeMenuPreferences,
  getMyMikkeMenuPreferences
} from "@/lib/mikkeos/menu-preferences";
import {
  isMikkeMenuAppKey,
  projectMikkeMenuPreferences,
  shouldIncludeGuestMarketNoteData,
  type MikkeMenuAppKey,
  type MikkeMenuPreferenceRow
} from "@/lib/mikkeos/menu-preferences-model";
import { mikkeMenuAppOrder, mikkeMenuAppRegistry } from "@/lib/mikkeos/released-apps";
import { supabase } from "@/lib/supabase/client";

export type MikkeOwnedAppKey = MikkeMenuAppKey;

const appByKey: Record<MikkeOwnedAppKey, MikkeOwnerMenuItem> = {
  marketnote: mikkeMenuAppRegistry.marketnote,
  story: mikkeMenuAppRegistry.story,
  community: mikkeMenuAppRegistry.community,
  ninteikoza: mikkeMenuAppRegistry.ninteikoza
};

const appOrder = mikkeMenuAppOrder;

// Community と認定講座サイト管理は一般公開していないため「つなげる候補」には出さない。
const connectableApps: Record<Exclude<MikkeOwnedAppKey, "community" | "ninteikoza">, MikkeOwnerMenuSuggestedApp> = {
  marketnote: { name: "MarketNote", helper: "出店予定や会計を記録できます", href: "/marketnote" },
  story: { name: "Story", helper: "プロフィールと活動の名刺をつくれます", href: "/story" }
};

/**
 * 所有アプリは画面ごとの固定値にせず、ログイン本人が持つアプリデータから判定する。
 * Community は未一般公開のため、有効な会員・運営者だけを所有扱いにし、候補には出さない。
 */
export function useOwnedMikkeApps({
  userId,
  isGuest = false
}: {
  userId?: string;
  isGuest?: boolean;
}) {
  const [detectedKeys, setDetectedKeys] = useState<MikkeOwnedAppKey[]>([]);
  const [hasGuestMarketNoteData, setHasGuestMarketNoteData] = useState(false);
  const [preferenceRows, setPreferenceRows] = useState<MikkeMenuPreferenceRow[]>([]);
  const [preferenceLoading, setPreferenceLoading] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [preferenceRevision, setPreferenceRevision] = useState(0);

  const refreshMenuPreferences = useCallback(() => {
    setPreferenceRevision((revision) => revision + 1);
  }, []);

  useEffect(() => {
    function syncGuestMarketNoteData() {
      setHasGuestMarketNoteData(getGuestMarketNoteStats().total > 0);
    }

    syncGuestMarketNoteData();
    window.addEventListener("mikke:marketnote-guest-updated", syncGuestMarketNoteData);
    window.addEventListener("storage", syncGuestMarketNoteData);
    return () => {
      window.removeEventListener("mikke:marketnote-guest-updated", syncGuestMarketNoteData);
      window.removeEventListener("storage", syncGuestMarketNoteData);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    function applyGuestPreferences() {
      if (cancelled) return;
      setPreferenceRows(getGuestMikkeMenuPreferences());
      setPreferenceError(null);
      setPreferenceLoading(false);
    }

    setPreferenceRows([]);
    setPreferenceError(null);

    if (isGuest) {
      setPreferenceLoading(true);
      applyGuestPreferences();
      window.addEventListener(MIKKE_GUEST_MENU_PREFERENCES_EVENT, applyGuestPreferences);
      const onStorage = (event: StorageEvent) => {
        if (event.key === MIKKE_GUEST_MENU_PREFERENCES_KEY) applyGuestPreferences();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        cancelled = true;
        window.removeEventListener(MIKKE_GUEST_MENU_PREFERENCES_EVENT, applyGuestPreferences);
        window.removeEventListener("storage", onStorage);
      };
    }

    if (!userId) {
      setPreferenceLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setPreferenceLoading(true);
    void getMyMikkeMenuPreferences()
      .then((rows) => {
        if (cancelled) return;
        setPreferenceRows(rows);
      })
      .catch(() => {
        if (cancelled) return;
        // RPC未適用・通信失敗時は空設定として扱い、全owned appを標準順で表示する。
        setPreferenceRows([]);
        setPreferenceError("アプリ表示設定を読み込めませんでした。標準の並び順で表示しています。");
      })
      .finally(() => {
        if (!cancelled) setPreferenceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isGuest, preferenceRevision, userId]);

  useEffect(() => {
    if (!userId || isGuest) {
      setDetectedKeys([]);
      return;
    }

    let cancelled = false;

    void Promise.all([
      supabase.from("mikke_app_entitlements").select("app_key,status,starts_at,ends_at").eq("user_id", userId),
      supabase.rpc("story_profile_get_mine"),
      supabase.from("market_events").select("id").eq("user_id", userId).limit(1),
      supabase.from("community_memberships").select("id").eq("user_id", userId).eq("status", "active").limit(1),
      supabase.from("community_communities").select("id").eq("owner_user_id", userId).eq("status", "active").limit(1)
    ]).then(([entitlements, story, marketnote, communityMembership, communityOwner]) => {
      if (cancelled) return;
      const next = new Set<MikkeOwnedAppKey>();
      const now = Date.now();

      for (const row of entitlements.data ?? []) {
        if (row.status !== "active" || !isMikkeMenuAppKey(row.app_key)) continue;
        if (row.starts_at && new Date(row.starts_at).getTime() > now) continue;
        if (row.ends_at && new Date(row.ends_at).getTime() <= now) continue;
        next.add(row.app_key);
      }

      if ((story.data?.length ?? 0) > 0) next.add("story");
      if ((marketnote.data?.length ?? 0) > 0) next.add("marketnote");
      if ((communityMembership.data?.length ?? 0) > 0 || (communityOwner.data?.length ?? 0) > 0) next.add("community");

      setDetectedKeys(appOrder.filter((key) => next.has(key)));
    });

    return () => {
      cancelled = true;
    };
  }, [isGuest, userId]);

  return useMemo(() => {
    const keys = new Set<MikkeOwnedAppKey>(detectedKeys);
    if (shouldIncludeGuestMarketNoteData(isGuest, hasGuestMarketNoteData)) keys.add("marketnote");
    const ownedKeysInStandardOrder = appOrder.filter((key) => keys.has(key));
    const projection = projectMikkeMenuPreferences(ownedKeysInStandardOrder, preferenceRows);
    const visibleOwnedApps = projection.visibleOwnedAppKeys.map((key) => appByKey[key]);
    const hiddenOwnedApps = projection.hiddenOwnedAppKeys.map((key) => appByKey[key]);
    const suggestedApps = (["marketnote", "story"] as const)
      .filter((key) => !keys.has(key))
      .map((key) => connectableApps[key]);
    return {
      ownedApps: visibleOwnedApps,
      suggestedApps,
      ownedAppKeys: projection.ownedAppKeys,
      visibleOwnedAppKeys: projection.visibleOwnedAppKeys,
      hiddenOwnedAppKeys: projection.hiddenOwnedAppKeys,
      visibleOwnedApps,
      hiddenOwnedApps,
      preferenceLoading,
      preferenceError,
      refreshMenuPreferences
    };
  }, [detectedKeys, hasGuestMarketNoteData, isGuest, preferenceError, preferenceLoading, preferenceRows, refreshMenuPreferences]);
}
