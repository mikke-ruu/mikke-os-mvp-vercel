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

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function MarketNoteGoogleImportPreview() {
  const { isGuest } = useAuth();
  const [fileName, setFileName] = useState("");
  const [calendar, setCalendar] = useState<ParsedIcsCalendar | null>(null);
  const [from, setFrom] = useState(() => offsetDateKey(-365));
  const [to, setTo] = useState(() => offsetDateKey(365));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState("");

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
      setErrorMessage(".icsファイルを選んでください。ZIPファイルはこの段階では対応していません。");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setErrorMessage("ファイルが大きすぎます。10MB以下の.icsファイルを選んでください。");
      return;
    }

    const text = await file.text();
    if (!/BEGIN:VCALENDAR/i.test(text)) {
      setErrorMessage("GoogleカレンダーのICS形式を確認できませんでした。");
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

  const allSelected = Boolean(preview?.items.length) && selectedIds.size === preview?.items.length;

  return (
    <MarketNoteShell title="Googleカレンダーを取り込む" subtitle="MarketNote" isGuest={isGuest}>
      <div className="space-y-4 pb-8">
        <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]">
              <ShieldCheck size={20} />
            </span>
            <div>
              <h1 className="text-lg font-bold text-[var(--mikke-text)]">ICSファイルをこの画面だけで確認</h1>
              <p className="mt-1 text-xs font-semibold leading-5 text-[var(--mikke-muted)]">
                ファイルはサーバー・Storage・DBへ送りません。説明、参加者、メール、会議URL、添付、リマインダーも読み取り結果へ残しません。
              </p>
            </div>
          </div>

          <label className="mt-4 flex min-h-20 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--mikke-accent)] bg-[var(--mikke-accent-soft)] px-4 text-sm font-bold text-[var(--mikke-accent)]">
            <FileUp size={19} />
            <span>{fileName || ".icsファイルを選択"}</span>
            <input type="file" accept=".ics,text/calendar" className="sr-only" onChange={(event) => void selectFile(event)} />
          </label>
          <p className="mt-2 text-[11px] font-semibold text-[var(--mikke-muted)]">Google Takeoutを展開した.icsファイル／最大10MB。ZIPは未対応です。</p>
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

            <button
              type="button"
              disabled
              className="min-h-12 w-full cursor-not-allowed rounded-xl bg-[var(--mikke-line)] px-4 text-sm font-bold text-white"
            >
              確定取り込みは次の段階で対応します
            </button>
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
          {item.dateKey} {item.allDay ? "終日" : `${item.localTime}（${item.timeZone}）`}
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
