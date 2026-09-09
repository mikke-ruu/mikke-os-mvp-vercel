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
  academy: mikkeMenuAppRegistry.academy,
  community: mikkeMenuAppRegistry.community,
  ninteikoza: mikkeMenuAppRegistry.ninteikoza
};

const appOrder = mikkeMenuAppOrder;

// 認定講座サイト管理は運営者へ個別付与するため「つなげる候補」には出さない。
const connectableApps: Record<Exclude<MikkeOwnedAppKey, "ninteikoza">, MikkeOwnerMenuSuggestedApp> = {
  marketnote: { name: "MarketNote", helper: "出店予定や会計を記録できます", href: "/marketnote" },
  story: { name: "Story", helper: "プロフィールと活動の名刺をつくれます", href: "/story" },
  academy: { name: "Academy", helper: "講座の作成・運営・受講を始められます", href: "/academy" },
  community: { name: "Community", helper: "お知らせ・質問・会話・予定をRoomに分けて交流できます", href: "/community" }
};

/**
 * 所有アプリは画面ごとの固定値にせず、ログイン本人が持つアプリデータから判定する。
 * Community と Academy は、実データがある本人だけを所有扱いにする。
 */
export function useOwnedMikkeApps({
  userId,
  isGuest = false
}: {
  userId?: string;
  isGuest?: boolean;
}) {
  const [detectedState, setDetectedState] = useState<{ ownerId: string; keys: MikkeOwnedAppKey[] } | null>(null);
  const [hasGuestMarketNoteData, setHasGuestMarketNoteData] = useState(false);
  const [preferenceRows, setPreferenceRows] = useState<MikkeMenuPreferenceRow[]>([]);
  const [preferenceOwner, setPreferenceOwner] = useState<string | null>(null);
  const currentPreferenceOwner = isGuest ? "guest" : userId ?? "signed-out";
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
      setPreferenceOwner("guest");
      setPreferenceError(null);
      setPreferenceLoading(false);
    }

    setPreferenceRows([]);
    setPreferenceOwner(null);
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
      setPreferenceOwner("signed-out");
      setPreferenceLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setPreferenceLoading(true);
    void getMyMikkeMenuPreferences(userId)
      .then((rows) => {
        if (cancelled) return;
        setPreferenceRows(rows);
        setPreferenceOwner(userId);
      })
      .catch(() => {
        if (cancelled) return;
        // RPC未適用・通信失敗時は空設定として扱い、全owned appを標準順で表示する。
        setPreferenceRows([]);
        setPreferenceOwner(userId);
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
      setDetectedState(null);
      return;
    }

    let cancelled = false;

    void Promise.all([
      supabase.from("mikke_app_entitlements").select("app_key,status,starts_at,ends_at").eq("user_id", userId),
      supabase.rpc("story_profile_get_mine"),
      supabase.from("market_events").select("id").eq("user_id", userId).limit(1),
      supabase.from("community_memberships").select("id").eq("user_id", userId).eq("status", "active").limit(1),
      supabase.from("community_communities").select("id").eq("owner_user_id", userId).eq("status", "active").limit(1),
      supabase.rpc("academy_list_my_contexts")
    ]).then(([entitlements, story, marketnote, communityMembership, communityOwner, academyContexts]) => {
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
      if (Array.isArray(academyContexts.data) && academyContexts.data.length > 0) next.add("academy");
      if ((communityMembership.data?.length ?? 0) > 0 || (communityOwner.data?.length ?? 0) > 0) next.add("community");

      setDetectedState({ ownerId: userId, keys: appOrder.filter((key) => next.has(key)) });
    });

    return () => {
      cancelled = true;
    };
  }, [isGuest, userId]);

  return useMemo(() => {
    const keys = new Set<MikkeOwnedAppKey>(detectedState && !isGuest && detectedState.ownerId === userId ? detectedState.keys : []);
    if (shouldIncludeGuestMarketNoteData(isGuest, hasGuestMarketNoteData)) keys.add("marketnote");
    const ownedKeysInStandardOrder = appOrder.filter((key) => keys.has(key));
    const ownerMatches = preferenceOwner === currentPreferenceOwner;
    const projection = projectMikkeMenuPreferences(ownedKeysInStandardOrder, ownerMatches ? preferenceRows : []);
    const visibleOwnedApps = projection.visibleOwnedAppKeys.map((key) => appByKey[key]);
    const hiddenOwnedApps = projection.hiddenOwnedAppKeys.map((key) => appByKey[key]);
    const suggestedApps = (["marketnote", "story", "academy", "community"] as const)
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
      preferenceLoading: preferenceLoading || !ownerMatches,
      preferenceError: ownerMatches ? preferenceError : null,
      refreshMenuPreferences
    };
  }, [detectedState, userId, hasGuestMarketNoteData, isGuest, currentPreferenceOwner, preferenceOwner, preferenceError, preferenceLoading, preferenceRows, refreshMenuPreferences]);
}
