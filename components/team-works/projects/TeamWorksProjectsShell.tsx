"use client";

import { FolderKanban } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { teamWorksTemplate } from "@/lib/team-works";

export function TeamWorksProjectsShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const projectsActive = pathname.startsWith("/apps/team-works/projects");
  const templatesActive = pathname.startsWith("/apps/team-works/project-templates");

  return (
    <MikkeAppShell
      appName="Team Works"
      title={title}
      subtitle={subtitle}
      currentApp={{ label: "Team", href: "/apps/team-works", icon: FolderKanban }}
      theme="green"
      footerLabel="Team Works by mikke"
      ownedApps={[]}
      otherApps={[]}
      suggestedApps={[]}
    >
      <nav aria-label="Team Worksの仕事モード" className="mb-6 flex flex-wrap gap-2 border-b border-[var(--mikke-line)] pb-3">
        <Link
          href="/apps/team-works"
          className={`rounded-lg px-3 py-2 text-xs font-bold ${
            projectsActive || templatesActive ? "text-[var(--mikke-muted)]" : "bg-[var(--mikke-primary)] text-white"
          }`}
        >
          継続業務
        </Link>
        <Link
          href="/apps/team-works/projects"
          className={`rounded-lg px-3 py-2 text-xs font-bold ${
            projectsActive ? "bg-[var(--mikke-primary)] text-white" : "text-[var(--mikke-muted)]"
          }`}
        >
          プロジェクト
        </Link>
        {teamWorksTemplate.featureSettings.enableProjectTemplates ? (
          <Link
            href="/apps/team-works/project-templates"
            className={`rounded-lg px-3 py-2 text-xs font-bold ${
              templatesActive ? "bg-[var(--mikke-primary)] text-white" : "text-[var(--mikke-muted)]"
            }`}
          >
            テンプレート
          </Link>
        ) : null}
      </nav>
      {children}
    </MikkeAppShell>
  );
}

export const teamWorksProjectInputClass =
  "mt-1.5 w-full appearance-none rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--mikke-accent)]";

export function TeamWorksProjectField({
  label,
  required = false,
  helper,
  className = "",
  children
}: {
  label: string;
  required?: boolean;
  helper?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-bold text-[var(--mikke-text)]">
        {label}
        {required ? <span className="ml-1 text-[var(--mikke-accent)]">*</span> : null}
      </span>
      {children}
      {helper ? <span className="mt-1 block text-xs leading-5 text-[var(--mikke-muted)]">{helper}</span> : null}
    </label>
  );
}
