"use client";

import { ChevronDown, ChevronUp, Eye, EyeOff, LayoutDashboard, RotateCcw } from "lucide-react";
import type { MikkeMenuAppKey } from "@/lib/mikkeos/menu-preferences-model";

export type ManagerMenuAppDraftItem = {
  key: MikkeMenuAppKey;
  label: string;
  isHidden: boolean;
};

export function ManagerAppMenuPreferencesPanel({
  apps,
  loading,
  saving,
  error,
  saved,
  retryable,
  onMove,
  onToggle,
  onSave,
  onReset,
  onRetry
}: {
  apps: ManagerMenuAppDraftItem[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  saved: boolean;
  retryable: boolean;
  onMove: (key: MikkeMenuAppKey, direction: -1 | 1) => void;
  onToggle: (key: MikkeMenuAppKey) => void;
  onSave: () => void;
  onReset: () => void;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold tracking-normal">アプリメニュー</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--mikke-muted)]">
        よく使うアプリを上へ移動したり、使わないアプリをメニューから隠したりできます。非表示にしても、アプリのデータや利用状態は削除されません。
      </p>

      <div className="mt-5 grid gap-2">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[var(--mikke-primary)]">
              <LayoutDashboard size={18} />
            </span>
            <span>
              <span className="block text-sm font-bold text-[var(--mikke-text)]">Manager</span>
              <span className="mt-0.5 block text-xs font-semibold text-[var(--mikke-muted)]">設定を元に戻せるよう、常に表示します</span>
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--mikke-muted)]">固定</span>
        </div>

        {loading ? (
          <p className="rounded-xl border border-dashed border-[var(--mikke-line)] p-4 text-center text-sm font-semibold text-[var(--mikke-muted)]">
            アプリメニューを読み込んでいます…
          </p>
        ) : apps.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--mikke-line)] p-4 text-center text-sm font-semibold text-[var(--mikke-muted)]">
            並べ替えられるアプリはまだありません。
          </p>
        ) : (
          apps.map((app, index) => (
            <div
              key={app.key}
              className={`flex flex-col items-stretch gap-2.5 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${
                app.isHidden
                  ? "border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)]"
                  : "border-[var(--mikke-line)] bg-white"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-[var(--mikke-text)]">{app.label}</span>
                <span className="mt-0.5 block text-xs font-semibold text-[var(--mikke-muted)]">
                  {app.isHidden ? "メニューでは非表示" : "メニューに表示中"}
                </span>
              </span>
              <span className="flex shrink-0 items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => onMove(app.key, -1)}
                  disabled={saving || retryable || index === 0}
                  aria-label={`${app.label}を上へ移動`}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)] disabled:opacity-30"
                >
                  <ChevronUp size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(app.key, 1)}
                  disabled={saving || retryable || index === apps.length - 1}
                  aria-label={`${app.label}を下へ移動`}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)] disabled:opacity-30"
                >
                  <ChevronDown size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => onToggle(app.key)}
                  disabled={saving || retryable}
                  className="ml-0.5 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--mikke-line)] bg-white px-2.5 text-xs font-bold text-[var(--mikke-primary)] disabled:opacity-50 sm:ml-1"
                >
                  {app.isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                  {app.isHidden ? "表示" : "隠す"}
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      {error ? (
        <div role="alert" className="mt-3 rounded-xl bg-[var(--mikke-surface-soft)] px-3 py-2 text-sm font-semibold text-[var(--mikke-danger)]">
          <p>{error}</p>
          {retryable ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={loading}
              className="mt-2 rounded-full border border-[var(--mikke-line)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--mikke-primary)] disabled:opacity-50"
            >
              再読み込み
            </button>
          ) : null}
        </div>
      ) : null}
      {saved ? <p role="status" className="mt-3 rounded-xl bg-[var(--mikke-success-soft)] px-3 py-2 text-sm font-semibold text-[var(--mikke-success)]">アプリメニューを保存しました。</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={loading || saving || retryable || apps.length === 0}
          className="rounded-full bg-[var(--mikke-primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? "保存中…" : "メニュー設定を保存"}
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={loading || saving || retryable}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--mikke-line)] bg-white px-4 py-2 text-sm font-bold text-[var(--mikke-muted)] disabled:opacity-50"
        >
          <RotateCcw size={15} />
          既定に戻す
        </button>
      </div>
    </section>
  );
}
