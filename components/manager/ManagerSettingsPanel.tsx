"use client";

import { useManagerPreferences } from "@/lib/manager/store";
import { ManagerShell } from "./ManagerShell";

const defaultViewOptions = [
  { value: "dashboard", label: "今日" },
  { value: "calendar", label: "予定" },
  { value: "tasks", label: "タスク" },
  { value: "progress", label: "進行" },
  { value: "history", label: "履歴" }
] as const;

export function ManagerSettingsPanel() {
  const { preferences, updatePreferences } = useManagerPreferences();

  return (
    <ManagerShell title="設定" subtitle="Managerの見え方だけを調整します。">
      <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold tracking-normal">表示設定</h2>
        <p className="mt-1 text-sm text-[var(--mikke-muted)]">設定はManager専用に保存され、各アプリのデータは変更しません。</p>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-bold text-[var(--mikke-text)]">最初に見たい画面</span>
            <select
              value={preferences.defaultView}
              onChange={(event) => updatePreferences({ defaultView: event.target.value as typeof preferences.defaultView })}
              className="rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm font-semibold"
            >
              {defaultViewOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
            <span>
              <span className="block text-sm font-bold text-[var(--mikke-text)]">完了済みも表示する</span>
              <span className="mt-1 block text-xs font-semibold text-[var(--mikke-muted)]">今後の絞り込みUIで使う準備設定です。</span>
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
    </ManagerShell>
  );
}

