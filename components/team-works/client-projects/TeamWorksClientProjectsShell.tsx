"use client";

import { CircleUserRound, FolderKanban, Users } from "lucide-react";
import { MikkeAppShell, type MikkeShellNavItem } from "@/components/mikkeos/MikkeAppShell";
import { useTeamWorksPortalRoles } from "@/components/team-works/useTeamWorksPortalRoles";

export function TeamWorksClientProjectsShell({
  title,
  subtitle,
  displayName,
  children
}: {
  title: string;
  subtitle: string;
  displayName?: string | null;
  children: React.ReactNode;
}) {
  // このシェルはクライアントポータル配下でのみ使われるため、クライアント項目は判定を待たず常に出す
  // （そうしないと役割判定が終わるまでサイドバー自体が一瞬消えてレイアウトが崩れる）。
  const { hasWorker } = useTeamWorksPortalRoles();
  const navItems: MikkeShellNavItem[] = [
    { label: "クライアントポータル", href: "/apps/team-works/portal/client", icon: FolderKanban },
    ...(hasWorker ? [{ label: "パートナーポータル", href: "/apps/team-works/portal/worker", icon: Users }] : [])
  ];
  return (
    <MikkeAppShell
      appName="Team Works"
      title={title}
      subtitle={subtitle}
      currentApp={{ label: "Team", href: "/apps/team-works/portal/client", icon: FolderKanban }}
      theme="green"
      footerLabel="Team Works by mikke"
      navItems={navItems}
    >
      <div className="mb-6 flex flex-col gap-3 border-b border-[var(--mikke-line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-2 text-xs font-bold text-[var(--mikke-muted)]">
          <FolderKanban size={16} /> 運営型プロジェクト
        </p>
        <p className="inline-flex items-center gap-2 text-xs font-bold text-[var(--mikke-muted)]">
          <CircleUserRound size={16} /> {displayName ? `${displayName}として表示` : "ログイン中の共有範囲を表示"}
        </p>
      </div>
      {children}
    </MikkeAppShell>
  );
}
