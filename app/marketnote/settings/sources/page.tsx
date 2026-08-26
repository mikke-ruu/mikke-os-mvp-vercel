"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Eye, EyeOff, FileUp } from "lucide-react";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { MarketNoteShell } from "@/components/marketnote/MarketNoteShell";
import {
  listMarketScheduleSourcePreferences,
  updateMarketScheduleSourcePreference,
  type MarketScheduleSourcePreference
} from "@/lib/marketnote-schedule-projections";

const sourceColors = ["#9CCDB9", "#FF5A3C", "#4455BB", "#FFD26F", "#F7CCCC", "#7CB7E8"];

function ScheduleSourceSettings() {
  const { isGuest } = useAuth();
  const [items, setItems] = useState<MarketScheduleSourcePreference[]>([]);
  const [loading, setLoading] = useState(!isGuest);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (isGuest) return;
    setLoading(true);
    try {
      setItems(await listMarketScheduleSourcePreferences());
    } catch {
      setMessage("予定ソースを読み込めませんでした。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  }, [isGuest]);

  useEffect(() => { void load(); }, [load]);

  async function save(item: MarketScheduleSourcePreference, patch: Partial<MarketScheduleSourcePreference>) {
    setBusyId(item.id);
    setMessage("");
    try {
      const updated = await updateMarketScheduleSourcePreference(item.id, {
        is_visible: patch.is_visible ?? item.is_visible,
        notifications_enabled: patch.notifications_enabled ?? item.notifications_enabled,
        display_color: patch.display_color ?? item.display_color
      });
      setItems((current) => current.map((row) => row.id === updated.id ? updated : row));
      setMessage("設定を保存しました");
    } catch {
      setMessage("設定を保存できませんでした。");
    } finally {
      setBusyId("");
    }
  }

  return (
    <MarketNoteShell title="表示する予定" subtitle="MarketNote" isGuest={isGuest}>
      <div className="space-y-4 pb-8">
        <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
          <h1 className="text-lg font-bold text-[var(--mikke-text)]">カレンダーに表示する予定</h1>
          <p className="mt-2 text-xs font-semibold leading-5 text-[var(--mikke-muted)]">Googleなど外部から移した予定の表示と色を変えられます。元のGoogle予定は変更しません。</p>
        </section>

        {isGuest ? (
          <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5 text-center shadow-sm">
            <p className="text-sm font-bold text-[var(--mikke-text)]">ログインすると予定ソースを設定できます</p>
          </section>
        ) : loading ? (
          <p className="py-8 text-center text-sm font-bold text-[var(--mikke-muted)]">読み込み中…</p>
        ) : items.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-white p-5 text-center">
            <p className="text-sm font-bold text-[var(--mikke-text)]">移行した予定はまだありません</p>
            <Link href="/marketnote/import/google" className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--mikke-accent)] px-4 text-xs font-bold text-[var(--mikke-accent)]"><FileUp size={16} />Googleカレンダーから移す</Link>
          </section>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <section key={item.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--mikke-text)]">{item.source_label ?? "外部の予定"}</p>
                    <p className="mt-1 text-[11px] font-semibold text-[var(--mikke-muted)]">Googleの内容は書き換えません</p>
                  </div>
                  <button type="button" disabled={busyId === item.id} onClick={() => void save(item, { is_visible: !item.is_visible })} className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold ${item.is_visible ? "border-[var(--mikke-green)] bg-[var(--mikke-green)] text-[var(--mikke-text)]" : "border-[var(--mikke-line)] text-[var(--mikke-muted)]"}`}>
                    {item.is_visible ? <Eye size={15} /> : <EyeOff size={15} />}{item.is_visible ? "表示" : "非表示"}
                  </button>
                </div>
                <div className="mt-4 border-t border-[var(--mikke-line-soft)] pt-3">
                  <p className="text-[11px] font-bold text-[var(--mikke-muted)]">表示色</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sourceColors.map((color) => <button key={color} type="button" aria-label={`表示色 ${color}`} disabled={busyId === item.id} onClick={() => void save(item, { display_color: color })} className={`h-8 w-8 rounded-full border-2 ${item.display_color.toLowerCase() === color.toLowerCase() ? "border-[var(--mikke-text)]" : "border-white"}`} style={{ backgroundColor: color, boxShadow: "0 0 0 1px var(--mikke-line)" }} />)}
                    <input type="color" value={item.display_color} disabled={busyId === item.id} onChange={(event) => void save(item, { display_color: event.target.value })} aria-label="自由な表示色" className="h-8 w-10 cursor-pointer rounded border border-[var(--mikke-line)] bg-white p-0.5" />
                  </div>
                </div>
                <div className="mt-4 border-t border-[var(--mikke-line-soft)] pt-3">
                  <button type="button" disabled={busyId === item.id} onClick={() => void save(item, { notifications_enabled: !item.notifications_enabled })} className="flex min-h-10 w-full items-center justify-between gap-3 text-left">
                    <span className="flex items-center gap-2 text-xs font-bold text-[var(--mikke-text)]"><Bell size={16} className="text-[var(--mikke-accent)]" />この予定の通知</span>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${item.notifications_enabled ? "bg-[var(--mikke-green)] text-[var(--mikke-text)]" : "bg-[var(--mikke-surface-soft)] text-[var(--mikke-muted)]"}`}>{item.notifications_enabled ? "ON" : "OFF"}</span>
                  </button>
                  <p className="mt-1 text-[10px] font-semibold leading-4 text-[var(--mikke-muted)]">通知設定は保存されます。スマホ通知・メール配信は現在準備中です。</p>
                </div>
              </section>
            ))}
          </div>
        )}
        {message ? <p className="rounded-xl bg-[var(--mikke-accent-soft)] px-3 py-2 text-xs font-bold text-[var(--mikke-text)]">{message}</p> : null}
      </div>
    </MarketNoteShell>
  );
}

export default function MarketNoteScheduleSourceSettingsPage() {
  return <AuthGate allowGuest><ScheduleSourceSettings /></AuthGate>;
}
