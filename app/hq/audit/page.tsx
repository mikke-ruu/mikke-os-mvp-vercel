"use client";

import { useEffect, useState } from "react";
import { History, ShieldCheck } from "lucide-react";
import { listHqAuditLogs, type HqAuditLog } from "@/lib/hq";

const entityLabels: Record<string, string> = {
  mikkeos_hq_inquiries: "お問い合わせ",
  mikkeos_hq_announcements: "お知らせ",
  mikkeos_hq_article_categories: "記事カテゴリー",
  mikkeos_hq_articles: "記事",
  mikkeos_hq_updates: "アップデート"
};

const actionLabels: Record<string, string> = {
  insert: "作成",
  update: "更新",
  delete: "削除"
};

export default function HqAuditPage() {
  const [items, setItems] = useState<HqAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listHqAuditLogs()
      .then(setItems)
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "操作履歴を読み込めませんでした。"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <p className="text-xs font-bold tracking-[0.15em] text-[var(--mikke-primary)]">SECURITY</p>
        <h1 className="mt-2 text-2xl font-bold">操作履歴</h1>
        <p className="mt-2 text-sm text-[var(--mikke-muted)]">本部で行った作成・更新・削除を自動で記録します。</p>
      </header>

      <p className="flex items-start gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 text-sm leading-6 text-[var(--mikke-muted)] shadow-sm">
        <ShieldCheck className="mt-0.5 shrink-0 text-green-600" size={20} />
        この履歴は本部オーナーと管理者だけが閲覧できます。利用者個人のアクティビティログとは別の、本部操作専用の記録です。
      </p>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {loading ? <p className="py-12 text-center text-sm text-[var(--mikke-muted)]">読み込んでいます…</p> : null}
      {!loading && items.length === 0 ? <p className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-white px-5 py-12 text-center text-sm text-[var(--mikke-muted)]">操作履歴はまだありません。</p> : null}

      <ol className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--mikke-primary-soft)] text-[var(--mikke-primary)]"><History size={17} /></span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--mikke-text)]">{entityLabels[item.entity_type] ?? item.entity_type}を{actionLabels[item.action] ?? item.action}しました</p>
              <p className="mt-1 text-xs text-[var(--mikke-muted)]">
                {new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(item.created_at))}
                {item.actor_user_id ? ` ・ 担当 ${item.actor_user_id.slice(0, 8)}` : " ・ システム処理"}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
