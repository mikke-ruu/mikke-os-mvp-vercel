"use client";

import { useCallback, useEffect, useState } from "react";
import { FileCheck2 } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { fetchMyDeliveryProjects, type DeliveryProjectSummary } from "@/lib/team-works-delivery";

export function TeamWorksDeliveryPortalProjectList({ basePath }: { basePath: string }) {
  const [projects, setProjects] = useState<DeliveryProjectSummary[] | null>(null);

  const load = useCallback(async () => {
    try {
      setProjects(await fetchMyDeliveryProjects(supabase));
    } catch {
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (projects === null || projects.length === 0) return null;

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-bold">納品型プロジェクト</h2>
        <p className="mt-1 text-sm text-[var(--mikke-muted)]">期日つきのタスクをカレンダーで確認できます。</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`${basePath}/${project.id}`}
            className="flex items-center gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 transition hover:border-[var(--tw-done)]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--mikke-yellow)] text-[var(--tw-on-tint)]">
              <FileCheck2 size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold">{project.title}</span>
              <span className="mt-1 block text-xs font-semibold text-[var(--mikke-muted)]">詳細を開く</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
