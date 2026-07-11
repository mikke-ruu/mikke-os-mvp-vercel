import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getAppPath } from "@/lib/mikkeos/routes";
import type { MikkeAppDefinition } from "@/lib/mikkeos/types";

export function AppCard({ app }: { app: MikkeAppDefinition }) {
  const statusLabel = {
    active: "実装土台あり",
    prototype: "接続検証",
    planned: "構想中"
  }[app.status];

  return (
    <article className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--mikke-accent)]">{statusLabel}</p>
          <h2 className="mt-1 text-xl font-bold tracking-normal text-[var(--mikke-text)]">{app.name}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">{app.role}</p>
        </div>
        <Link
          href={getAppPath(app.key)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]"
          aria-label={`${app.name}を開く`}
          title={`${app.name}を開く`}
        >
          <ArrowRight size={18} />
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MiniList title="共通台帳へ送る内容" items={app.activityExamples} />
        <MiniList title="Storyで見える内容" items={app.storyOutputs} />
        <MiniList title="DESKで集計する内容" items={app.deskOutputs} />
      </div>
    </article>
  );
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-[var(--mikke-line-soft)] bg-[var(--mikke-surface-soft)] p-3">
      <p className="text-xs font-bold text-[var(--mikke-text)]">{title}</p>
      <ul className="mt-2 space-y-1.5 text-xs font-semibold leading-5 text-[var(--mikke-muted)]">
        {items.slice(0, 3).map((item) => (
          <li key={item}>・{item}</li>
        ))}
      </ul>
    </div>
  );
}
