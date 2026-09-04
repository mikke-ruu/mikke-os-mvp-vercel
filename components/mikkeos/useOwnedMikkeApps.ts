"use client";

import { useEffect, useMemo, useState } from "react";
import type { MikkeOwnerMenuItem, MikkeOwnerMenuSuggestedApp } from "./MikkeOwnerMenu";
import { getGuestMarketNoteStats } from "@/lib/marketnote-guest";
import { academyApp, communityApp, marketNoteApp, ninteiKozaApp, storyApp } from "@/lib/mikkeos/released-apps";
import { supabase } from "@/lib/supabase/client";

export type MikkeOwnedAppKey = "marketnote" | "story" | "academy" | "community" | "ninteikoza";

const appByKey: Record<MikkeOwnedAppKey, MikkeOwnerMenuItem> = {
  marketnote: marketNoteApp,
  story: storyApp,
  academy: academyApp,
  community: communityApp,
  ninteikoza: ninteiKozaApp
};

const appOrder: MikkeOwnedAppKey[] = ["marketnote", "story", "academy", "community", "ninteikoza"];

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
  const [detectedKeys, setDetectedKeys] = useState<MikkeOwnedAppKey[]>([]);
  const [hasGuestMarketNoteData, setHasGuestMarketNoteData] = useState(false);

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
      supabase.from("community_communities").select("id").eq("owner_user_id", userId).eq("status", "active").limit(1),
      supabase.rpc("academy_list_my_contexts")
    ]).then(([entitlements, story, marketnote, communityMembership, communityOwner, academyContexts]) => {
      if (cancelled) return;
      const next = new Set<MikkeOwnedAppKey>();
      const now = Date.now();

      for (const row of entitlements.data ?? []) {
        if (row.status !== "active" || !isOwnedAppKey(row.app_key)) continue;
        if (row.starts_at && new Date(row.starts_at).getTime() > now) continue;
        if (row.ends_at && new Date(row.ends_at).getTime() <= now) continue;
        next.add(row.app_key);
      }

      if ((story.data?.length ?? 0) > 0) next.add("story");
      if ((marketnote.data?.length ?? 0) > 0) next.add("marketnote");
      if (Array.isArray(academyContexts.data) && academyContexts.data.length > 0) next.add("academy");
      if ((communityMembership.data?.length ?? 0) > 0 || (communityOwner.data?.length ?? 0) > 0) next.add("community");

      setDetectedKeys(appOrder.filter((key) => next.has(key)));
    });

    return () => {
      cancelled = true;
    };
  }, [isGuest, userId]);

  return useMemo(() => {
    const keys = new Set<MikkeOwnedAppKey>(detectedKeys);
    if (hasGuestMarketNoteData) keys.add("marketnote");
    const ownedApps = appOrder.filter((key) => keys.has(key)).map((key) => appByKey[key]);
    const suggestedApps = (["marketnote", "story", "academy", "community"] as const)
      .filter((key) => !keys.has(key))
      .map((key) => connectableApps[key]);
    return { ownedApps, suggestedApps };
  }, [detectedKeys, hasGuestMarketNoteData]);
}

function isOwnedAppKey(value: string): value is MikkeOwnedAppKey {
  return value === "marketnote" || value === "story" || value === "academy" || value === "community" || value === "ninteikoza";
}
