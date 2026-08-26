"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { AlertTriangle, CalendarDays, Check, FileUp, ShieldCheck } from "lucide-react";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { MarketNoteShell } from "@/components/marketnote/MarketNoteShell";
import {
  buildIcsPreview,
  parseIcsCalendar,
  type IcsPreviewItem,
  type ParsedIcsCalendar
} from "@/lib/marketnote-ics-preview.mjs";
import { buildGoogleManualImportRequest } from "@/lib/marketnote-google-import-contract.mjs";
import { saveGoogleManualImport } from "@/lib/marketnote-google-import";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function MarketNoteGoogleImportPreview() {
  const { isGuest } = useAuth();
  const [fileName, setFileName] = useState("");
  const [calendar, setCalendar] = useState<ParsedIcsCalendar | null>(null);
  const [from, setFrom] = useState(() => offsetDateKey(-365));
  const [to, setTo] = useState(() => offsetDateKey(365));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const preview = useMemo(
    () => calendar ? buildIcsPreview(calendar, { from, to }) : null,
    [calendar, from, to]
  );

  useEffect(() => {
    setSelectedIds(new Set(preview?.items.map((item) => item.id) ?? []));
  }, [preview]);

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setCalendar(null);
    setFileName("");
    setErrorMessage("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".ics")) {
      setErrorMessage("Googleカレンダーから書き出した予定ファイル（.ics）を選んでください。ZIPファイルは先に展開してください。");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setErrorMessage("ファイルが大きすぎます。10MB以下の予定ファイル（.ics）を選んでください。");
      return;
    }

    const text = await file.text();
    if (!/BEGIN:VCALENDAR/i.test(text)) {
      setErrorMessage("Googleカレンダーから書き出した予定ファイルか確認できませんでした。");
      return;
    }

    setFileName(file.name);
    setCalendar(parseIcsCalendar(text));
  }

  function toggleItem(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveSelectedItems() {
    if (!preview || isGuest || saving) return;
    setErrorMessage("");
    setSaveMessage("");
    setSaving(true);
    try {
      const selected = preview.items.filter((item) => selectedIds.has(item.id));
      const request = buildGoogleManualImportRequest(preview.calendarName, selected);
      const result = await saveGoogleManualImport(request);
      setSaveMessage(`${result.total}件をMarketNoteへ取り込みました（新規${result.inserted}件・更新${result.updated}件）。`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "取り込みに失敗しました。通信状態を確認してください。");
    } finally {
      setSaving(false);
    }
  }

  const allSelected = Boolean(preview?.items.length) && selectedIds.size === preview?.items.length;

  return (
    <MarketNoteShell title="Googleの予定をファイルから移す" subtitle="MarketNote" isGuest={isGuest}>
      <div className="space-y-4 pb-8">
        <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]">
              <ShieldCheck size={20} />
            </span>
            <div>
              <h1 className="text-lg font-bold text-[var(--mikke-text)]">この方法は手動です</h1>
              <p className="mt-1 text-xs font-semibold leading-5 text-[var(--mikke-muted)]">
                Googleへログインして自動同期する画面ではありません。Googleカレンダーから予定ファイルを書き出し、この画面で選びます。
              </p>
            </div>
          </div>

          <ol className="mt-4 space-y-2 rounded-xl bg-[var(--mikke-yellow)] px-3 py-3 text-xs font-semibold leading-5 text-[var(--mikke-text)]">
            <li><span className="font-extrabold">1.</span> Google Takeoutで「カレンダー」だけを選び、データを書き出す</li>
            <li><span className="font-extrabold">2.</span> ダウンロードしたZIPファイルを開く</li>
            <li><span className="font-extrabold">3.</span> 中にある予定ファイル（末尾が .ics）を下から選ぶ</li>
          </ol>

          <label className="mt-4 flex min-h-20 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--mikke-accent)] bg-[var(--mikke-accent-soft)] px-4 text-sm font-bold text-[var(--mikke-accent)]">
            <FileUp size={19} />
            <span>{fileName || "書き出した予定ファイルを選ぶ"}</span>
            <input type="file" accept=".ics,text/calendar" className="sr-only" onChange={(event) => void selectFile(event)} />
          </label>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-[var(--mikke-muted)]">
            少し手間のかかる移行方法です。選んだ元ファイルはサーバー・Storage・DBへ送りません。説明、参加者、メール、会議URL等も保存しません。
          </p>
          {errorMessage ? <p className="mt-3 rounded-xl bg-[var(--mikke-pink)] px-3 py-2 text-xs font-bold text-[var(--mikke-text)]">{errorMessage}</p> : null}
        </section>

        {calendar && preview ? (
          <>
            <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-[var(--mikke-accent)]" />
                <h2 className="text-base font-bold text-[var(--mikke-text)]">{preview.calendarName}</h2>
              </div>
              <div className="mt-4 grid min-w-0 grid-cols-2 gap-3">
                <DateField label="開始日" value={from} onChange={setFrom} />
                <DateField label="終了日" value={to} onChange={setTo} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <CountCard label="対象" value={preview.items.length} />
                <CountCard label="重複" value={preview.duplicateCount} />
                <CountCard label="警告" value={preview.warnings.length} />
              </div>
            </section>

            {preview.warnings.length ? (
              <section className="rounded-2xl border border-[var(--mikke-yellow)] bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-[var(--mikke-text)]">
                  <AlertTriangle size={18} className="text-[var(--mikke-orange)]" />
                  <h2 className="text-sm font-bold">確認が必要な項目</h2>
                </div>
                <ul className="mt-3 space-y-2 text-xs font-semibold leading-5 text-[var(--mikke-muted)]">
                  {preview.warnings.map((warning) => <li key={warning}>・{warning}</li>)}
                </ul>
                {preview.skippedCount ? <p className="mt-3 text-xs font-bold text-[var(--mikke-text)]">除外・取消: {preview.skippedCount}件</p> : null}
              </section>
            ) : null}

            <section className="overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[var(--mikke-line-soft)] px-4 py-3">
                <div>
                  <h2 className="text-sm font-bold text-[var(--mikke-text)]">取り込む予定を選択</h2>
                  <p className="mt-1 text-[11px] font-semibold text-[var(--mikke-muted)]">{selectedIds.size}件を選択中</p>
                </div>
                {preview.items.length ? (
                  <button
                    type="button"
                    onClick={() => setSelectedIds(allSelected ? new Set() : new Set(preview.items.map((item) => item.id)))}
                    className="rounded-full border border-[var(--mikke-line)] px-3 py-1.5 text-[11px] font-bold text-[var(--mikke-accent)]"
                  >
                    {allSelected ? "すべて外す" : "すべて選ぶ"}
                  </button>
                ) : null}
              </div>

              {preview.items.length ? (
                <div className="divide-y divide-[var(--mikke-line-soft)]">
                  {preview.items.map((item) => (
                    <PreviewRow key={item.id} item={item} selected={selectedIds.has(item.id)} onToggle={() => toggleItem(item.id)} />
                  ))}
                </div>
              ) : (
                <p className="px-4 py-8 text-center text-sm font-semibold text-[var(--mikke-muted)]">選択期間に確認できる予定はありません。</p>
              )}
            </section>

            {saveMessage ? <p className="rounded-xl bg-[var(--mikke-green)] px-4 py-3 text-sm font-bold text-[var(--mikke-text)]">{saveMessage}</p> : null}
            <button
              type="button"
              disabled={isGuest || saving || selectedIds.size === 0}
              onClick={() => void saveSelectedItems()}
              className="min-h-12 w-full rounded-xl bg-[var(--mikke-accent)] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[var(--mikke-line)]"
            >
              {saving ? "取り込み中…" : isGuest ? "ログインすると取り込めます" : `${selectedIds.size}件をMarketNoteへ取り込む`}
            </button>
            <p className="text-center text-[11px] font-semibold leading-5 text-[var(--mikke-muted)]">
              同じ予定をもう一度選んでも二重登録せず、最新内容へ更新します。Google側の説明・参加者・メール等は保存しません。
            </p>
          </>
        ) : null}
      </div>
    </MarketNoteShell>
  );
}

function PreviewRow({ item, selected, onToggle }: { item: IcsPreviewItem; selected: boolean; onToggle: () => void }) {
  return (
    <label className="grid cursor-pointer grid-cols-[26px_1fr] gap-2 px-4 py-3">
      <input type="checkbox" checked={selected} onChange={onToggle} className="sr-only" />
      <span className={`mt-0.5 grid h-5 w-5 place-items-center rounded border ${selected ? "border-[var(--mikke-green)] bg-[var(--mikke-green)]" : "border-[var(--mikke-line)] bg-white"}`}>
        {selected ? <Check size={14} className="text-[var(--mikke-text)]" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-[var(--mikke-text)]">{item.title}</span>
        <span className="mt-1 block text-xs font-semibold text-[var(--mikke-muted)]">
          {item.dateKey} {item.allDay ? "終日" : `${item.localTime}（${item.timeZone}）`}{item.status === "cancelled" ? "・取消として反映" : ""}
        </span>
      </span>
    </label>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="min-w-0">
      <span className="text-[11px] font-bold text-[var(--mikke-muted)]">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-11 w-full min-w-0 max-w-full rounded-xl border border-[var(--mikke-line)] bg-white px-2 text-sm font-semibold text-[var(--mikke-text)]"
      />
    </label>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[var(--mikke-surface-soft)] px-2 py-3">
      <p className="text-lg font-extrabold text-[var(--mikke-accent)]">{value}</p>
      <p className="mt-1 text-[10px] font-bold text-[var(--mikke-muted)]">{label}</p>
    </div>
  );
}

function offsetDateKey(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function MarketNoteGoogleImportPage() {
  return (
    <AuthGate allowGuest>
      <MarketNoteGoogleImportPreview />
    </AuthGate>
  );
}
