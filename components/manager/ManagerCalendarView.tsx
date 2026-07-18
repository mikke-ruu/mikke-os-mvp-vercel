"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { ManagerScheduleList } from "./ManagerCards";
import { ManagerShell } from "./ManagerShell";
import { useManagerSnapshot } from "@/lib/manager/collect-manager-items";
import { useManagerPersonalEvents } from "@/lib/manager/store";

export function ManagerCalendarView() {
  const { profile } = useAuth();
  const snapshot = useManagerSnapshot(profile.id);
  const { createPersonalEvent } = useManagerPersonalEvents();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("");
  const [note, setNote] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !date) return;
    createPersonalEvent({ title: title.trim(), date, startTime, endTime: "", note: note.trim() });
    setTitle("");
    setStartTime("");
    setNote("");
  }

  return (
    <ManagerShell title="予定" subtitle="各アプリの予定と、Manager内だけの個人予定をまとめます。">
      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold tracking-normal">個人予定を追加</h2>
          <p className="mt-1 text-sm text-[var(--mikke-muted)]">この予定はManager内だけに保存され、StoryやDESKには流れません。</p>
          <div className="mt-4 grid gap-3">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="予定名" className="rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-sm font-semibold" />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-sm font-semibold" />
              <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-sm font-semibold" />
            </div>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="メモ" rows={3} className="rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-sm font-semibold" />
            <button type="submit" className="rounded-full bg-[var(--mikke-accent)] px-4 py-2 text-sm font-bold text-white shadow-sm">
              追加する
            </button>
          </div>
        </form>

        <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-bold tracking-normal">予定一覧</h2>
          <ManagerScheduleList items={snapshot.schedules} />
        </section>
      </section>
    </ManagerShell>
  );
}

