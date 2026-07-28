"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { DEFAULT_LABELS, resolveTeamWorksLabels, type TeamWorksLabels } from "@/lib/team-works-labels";

// 同一ページ内で複数コンポーネントが同時にマウントしても、
// 同じユーザーの問い合わせを1回にまとめるための簡易キャッシュ。
let cachedPromise: Promise<TeamWorksLabels> | null = null;

async function fetchLabels(): Promise<TeamWorksLabels> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return DEFAULT_LABELS;

  const [owned, membership] = await Promise.all([
    supabase.from("team_works_organizations").select("id,label_settings").eq("owner_user_id", user.id).limit(1),
    supabase
      .from("team_works_organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
  ]);

  if (owned.data && owned.data.length > 0) {
    return resolveTeamWorksLabels(owned.data[0].label_settings as Partial<TeamWorksLabels> | null);
  }
  const organizationId = membership.data?.[0]?.organization_id as string | undefined;
  if (!organizationId) return DEFAULT_LABELS;

  const { data: organization } = await supabase
    .from("team_works_organizations")
    .select("label_settings")
    .eq("id", organizationId)
    .maybeSingle();
  return resolveTeamWorksLabels(organization?.label_settings as Partial<TeamWorksLabels> | null);
}

// 表示名オーバーライドを取得するフック。読み込み中・未ログイン・取得失敗時は
// 常にDEFAULT_LABELS(既存組織の現行文言)を返すため、失敗時にアリサの表示が
// 崩れることはない。
export function useTeamWorksLabels(): TeamWorksLabels {
  const [labels, setLabels] = useState<TeamWorksLabels>(DEFAULT_LABELS);

  useEffect(() => {
    let cancelled = false;
    if (!cachedPromise) cachedPromise = fetchLabels().catch(() => DEFAULT_LABELS);
    cachedPromise.then((result) => {
      if (!cancelled) setLabels(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return labels;
}
