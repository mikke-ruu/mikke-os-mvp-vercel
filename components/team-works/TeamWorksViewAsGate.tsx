"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { supabase } from "@/lib/supabase/client";
import { TeamWorksViewAsProvider, type TeamWorksViewAs } from "@/components/team-works/TeamWorksViewAsContext";
import { SAMPLE_MEMBER_ID } from "@/lib/team-works-portal-sample-data";

// O-3 / Phase P: ポータルのルートで URL パラメータを読み取り、表示モードを決める。
//
//   ?as=<organization_member_id>        … その実在メンバーとして表示
//   ?as=sample&project=<project_id>     … 招待前でもサンプルデータで表示
//
// 権限について: RLS上、対象メンバー行やプロジェクト行を読めるのは同じ組織の
// staff(と本人)だけなので、権限のないユーザーがURLを直打ちしても解決できず
// 下の「表示できません」で止まる。ポータル本体の読み込みも同じRLSの下で動くため、
// ここは入口の分かりやすさのためのチェックであって、認可の本体ではない。
export function TeamWorksViewAsGate({
  role,
  children
}: {
  role: TeamWorksViewAs["role"];
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const asMemberId = searchParams.get("as") ?? undefined;
  const sampleProjectId = searchParams.get("project") ?? undefined;
  const isSample = asMemberId === SAMPLE_MEMBER_ID;
  const [viewAs, setViewAs] = useState<TeamWorksViewAs | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let active = true;
    if (!asMemberId) {
      setViewAs(null);
      setDenied(false);
      return;
    }
    if (isSample) {
      // サンプルは対象メンバーが存在しないので、解決するものが無い。
      // プロジェクトIDが無いと何も組み立てられないため、その場合だけ弾く。
      setDenied(!sampleProjectId);
      setViewAs(sampleProjectId ? { organizationMemberId: SAMPLE_MEMBER_ID, displayName: "サンプル", role, sampleProjectId } : null);
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
  }, [asMemberId, isSample, sampleProjectId, role]);

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

  // children は関数ではなく素の要素で受ける。page.tsx がサーバーコンポーネントの
  // ため、関数を子として渡すと "Functions are not valid as a child of Client
  // Components" になる。表示モードは context 経由で各ポータルが読む。
  return <TeamWorksViewAsProvider value={viewAs}>{children}</TeamWorksViewAsProvider>;
}
