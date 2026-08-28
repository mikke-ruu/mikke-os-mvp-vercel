"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { ManagerScheduleList } from "./ManagerCards";
import { ManagerShell } from "./ManagerShell";
import { useManagerSnapshot } from "@/lib/manager/collect-manager-items";
import { useManagerPersonalEvents } from "@/lib/manager/store";
import type { ManagerPersonalEvent } from "@/lib/manager/types";

export function ManagerCalendarView({ legacyOnly = false }: { legacyOnly?: boolean }) {
  const { profile } = useAuth();
  const snapshot = useManagerSnapshot(profile.id, profile.user_id);
  const { personalEvents, createPersonalEvent, updatePersonalEvent, removePersonalEvent, togglePersonalEventCompleted } = useManagerPersonalEvents();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !date) return;
    if (editingId) {
      updatePersonalEvent(editingId, { title: title.trim(), date, startTime, endTime, note: note.trim() });
    } else if (!legacyOnly) {
      createPersonalEvent({ title: title.trim(), date, startTime, endTime, note: note.trim() });
    }
    resetForm();
  }

  function startEdit(event: ManagerPersonalEvent) {
    setEditingId(event.id);
    setTitle(event.title);
    setDate(event.date);
    setStartTime(event.startTime);
    setEndTime(event.endTime);
    setNote(event.note);
  }

  function handleRemove(id: string) {
    removePersonalEvent(id);
    if (editingId === id) resetForm();
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setStartTime("");
    setEndTime("");
    setNote("");
  }

  return (
    <ManagerShell
      title={legacyOnly ? "以前の個人予定" : "予定"}
      subtitle={legacyOnly
        ? "この端末のManagerに残っている個人予定を確認・編集できます。"
        : "各アプリの予定と、Manager内だけの個人予定をまとめます。"}
    >
      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        {legacyOnly && !editingId ? (
          <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold tracking-normal">新しい予定はMarketNoteへ</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--mikke-muted)]">
              ここでは過去にManagerへ保存した個人予定だけを保管します。新しい予定はMarketNoteのカレンダーから追加してください。
            </p>
            <Link
              href="/marketnote?from=manager"
              className="mt-4 inline-flex rounded-full bg-[var(--mikke-primary)] px-4 py-2 text-sm font-bold text-white"
            >
              MarketNoteで予定を管理
            </Link>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold tracking-normal">{editingId ? "個人予定を編集" : "個人予定を追加"}</h2>
          <p className="mt-1 text-sm text-[var(--mikke-muted)]">この予定はManager内だけに保存され、StoryやDESKには流れません。</p>
          <div className="mt-4 grid gap-3">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="予定名" className="rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-sm font-semibold" />
            <div className="grid grid-cols-3 gap-2">
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-sm font-semibold" />
              <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-sm font-semibold" />
              <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-sm font-semibold" />
            </div>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="メモ" rows={3} className="rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-sm font-semibold" />
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="rounded-full bg-[var(--mikke-accent)] px-4 py-2 text-sm font-bold text-white shadow-sm">
                {editingId ? "保存する" : "追加する"}
              </button>
              {editingId ? (
                <button type="button" onClick={resetForm} className="rounded-full border border-[var(--mikke-line)] bg-white px-4 py-2 text-sm font-bold text-[var(--mikke-muted)]">
                  キャンセル
                </button>
              ) : null}
            </div>
          </div>
          </form>
        )}

        <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm xl:col-start-1">
          <h2 className="mb-3 text-lg font-bold tracking-normal">個人予定</h2>
          {personalEvents.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4 text-sm font-semibold text-[var(--mikke-muted)]">
              個人予定はまだありません。
            </p>
          ) : (
            <div className="grid gap-2">
              {personalEvents.map((event) => (
                <div key={event.id} className="rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-bold ${event.completedAt ? "text-[var(--mikke-muted)] line-through" : "text-[var(--mikke-text)]"}`}>{event.title}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">
                        {event.date}{event.startTime ? ` ${event.startTime}${event.endTime ? `-${event.endTime}` : ""}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePersonalEventCompleted(event.id, !event.completedAt)}
                      className="shrink-0 rounded-full border border-[var(--mikke-line)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--mikke-primary)]"
                    >
                      {event.completedAt ? "戻す" : "完了"}
                    </button>
                  </div>
                  {event.note ? <p className="mt-2 text-xs font-semibold leading-5 text-[var(--mikke-muted)]">{event.note}</p> : null}
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => startEdit(event)} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[var(--mikke-primary)]">
                      編集
                    </button>
                    <button type="button" onClick={() => handleRemove(event.id)} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[var(--mikke-muted)]">
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {!legacyOnly ? (
          <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-bold tracking-normal">予定一覧</h2>
            <ManagerScheduleList items={snapshot.schedules} />
          </section>
        ) : null}
      </section>
    </ManagerShell>
  );
}
