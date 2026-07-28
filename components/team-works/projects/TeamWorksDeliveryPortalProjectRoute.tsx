"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { isDatabaseProjectId } from "@/lib/team-works-operations-project";
import { TeamWorksDeliveryPortalProjectDetail } from "./TeamWorksDeliveryPortalProjectDetail";

// Supabase上に実在する納品型プロジェクトかどうかを確認し、あれば新しい
// Supabase接続版を、無ければ(=旧localStorage版のプロジェクト)呼び出し元の
// フォールバックをそのまま表示する。worker/client両ポータルで共通利用。
export function TeamWorksDeliveryPortalProjectRoute({ projectId, fallback }: { projectId: string; fallback: React.ReactNode }) {
  const [exists, setExists] = useState<boolean | undefined>(undefined);

  const check = useCallback(async () => {
    if (!isDatabaseProjectId(projectId)) {
      setExists(false);
      return;
    }
    const { data, error } = await supabase.from("team_works_projects").select("id").eq("id", projectId).eq("style", "delivery").maybeSingle();
    setExists(!error && Boolean(data));
  }, [projectId]);

  useEffect(() => {
    void check();
  }, [check]);

  if (exists === undefined) return <p className="text-sm font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>;
  if (exists) return <TeamWorksDeliveryPortalProjectDetail projectId={projectId} />;
  return <>{fallback}</>;
}
