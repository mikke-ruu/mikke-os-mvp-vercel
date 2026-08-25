"use client";

import Link from "next/link";
import { useManagerPersonalEvents, useManagerPreferences } from "@/lib/manager/store";
import { ManagerShell } from "./ManagerShell";

export function ManagerSettingsPanel() {
  const { preferences, updatePreferences } = useManagerPreferences();
  const { personalEvents } = useManagerPersonalEvents();

  return (
    <ManagerShell title="設定" subtitle="Managerとアプリメニューの見え方を調整します。">
      <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold tracking-normal">表示設定</h2>
        <p className="mt-1 text-sm text-[var(--mikke-muted)]">設定はManager専用に保存され、各アプリのデータは変更しません。</p>

        <div className="mt-5 grid gap-4">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
            <span>
              <span className="block text-sm font-bold text-[var(--mikke-text)]">完了済みも表示する</span>
              <span className="mt-1 block text-xs font-semibold text-[var(--mikke-muted)]">完了・キャンセル済みの予定や進行もManager一覧に残します。</span>
            </span>
            <input
              type="checkbox"
              checked={preferences.showCompleted}
              onChange={(event) => updatePreferences({ showCompleted: event.target.checked })}
              className="h-5 w-5 accent-[var(--mikke-accent)]"
            />
          </label>
        </div>
      </section>

      {personalEvents.length > 0 ? (
        <section className="mt-5 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold tracking-normal">以前の個人予定</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--mikke-muted)]">
            この端末のManagerに保存されている個人予定が{personalEvents.length}件あります。MarketNoteへの移行方法が決まるまで、ここから確認・編集できます。
          </p>
          <Link
            href="/manager/calendar"
            className="mt-4 inline-flex rounded-full border border-[var(--mikke-line)] bg-white px-4 py-2 text-sm font-bold text-[var(--mikke-primary)]"
          >
            個人予定を確認する
          </Link>
        </section>
      ) : null}
    </ManagerShell>
  );
}
