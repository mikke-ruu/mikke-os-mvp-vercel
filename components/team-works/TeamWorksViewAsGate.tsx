"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { supabase } from "@/lib/supabase/client";
import { TeamWorksViewAsProvider, type TeamWorksViewAs } from "@/components/team-works/TeamWorksViewAsContext";

// O-3: ポータルのルートで ?as=<organization_member_id> を読み取り、
// 対象者の表示名を解決してからTeamWorksViewAsProviderを張る。
//
// 権限について: RLS上、対象メンバー行を読めるのは同じ組織のstaff(と本人)だけなので、
// 権限のないユーザーがURLを直打ちしても表示名すら解決できず下の「表示できません」で
// 止まる。ポータル本体の読み込み(loadOperations*PortalAs)も同じRLSの下で動くため、
// ここは入口の分かりやすさのためのチェックであって、認可の本体ではない。
export function TeamWorksViewAsGate({
  role,
  children
}: {
  role: TeamWorksViewAs["role"];
  children: (viewAsMemberId: string | undefined) => ReactNode;
}) {
  const searchParams = useSearchParams();
  const asMemberId = searchParams.get("as") ?? undefined;
  const [viewAs, setViewAs] = useState<TeamWorksViewAs | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let active = true;
    if (!asMemberId) {
      setViewAs(null);
      setDenied(false);
      return;
    }
    void supabase
      .from("team_works_organization_members")
      .select("id,display_name")
      .eq("id", asMemberId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          setDenied(true);
          return;
        }
        setDenied(false);
        setViewAs({ organizationMemberId: data.id as string, displayName: (data.display_name as string) ?? null, role });
      });
    return () => {
      active = false;
    };
  }, [asMemberId, role]);

  if (asMemberId && denied) {
    return (
      <div className="p-6">
        <MikkeEmptyState
          title="この画面は表示できません"
          helper="「〜として表示」は本部権限のアカウントでのみ使えます。対象者が同じ組織のメンバーかも確認してください。"
        />
      </div>
    );
  }
  // 解決前は本人モードで描画してしまわないよう、ローディングを挟む。
  if (asMemberId && !viewAs) {
    return <p className="p-6 text-sm font-semibold text-[var(--mikke-muted)]">読み込み中…</p>;
  }

  return <TeamWorksViewAsProvider value={viewAs}>{children(viewAs?.organizationMemberId)}</TeamWorksViewAsProvider>;
}
