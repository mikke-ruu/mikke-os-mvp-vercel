"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Circle, Flag } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { StatCard } from "@/components/StatCard";
import { formatDate, formatYen } from "@/lib/format";
import {
  addCheckItem,
  addFinancialRecord,
  completeMarketEvent,
  getMarketEventBundle,
  saveReflection,
  toggleCheckItem
} from "@/lib/marketnote";
import type { MarketCheckItem, MarketEvent, MarketFinancialRecord, MarketReflection } from "@/types/database";

function MarketDetailContent() {
  const params = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [event, setEvent] = useState<MarketEvent | null>(null);
  const [checks, setChecks] = useState<MarketCheckItem[]>([]);
  const [finances, setFinances] = useState<MarketFinancialRecord[]>([]);
  const [reflection, setReflection] = useState<MarketReflection | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const bundle = await getMarketEventBundle(profile.id, params.id);
    setEvent(bundle.event);
    setChecks(bundle.checks);
    setFinances(bundle.finances);
    setReflection(bundle.reflection);
  }

  useEffect(() => {
    load();
  }, [params.id, profile.id]);

  const totals = useMemo(() => {
    const revenue = finances.filter((row) => row.record_type === "revenue").reduce((sum, row) => sum + Number(row.amount), 0);
    const expense = finances.filter((row) => row.record_type === "expense").reduce((sum, row) => sum + Number(row.amount), 0);
    return { revenue, expense, profit: revenue - expense };
  }, [finances]);

  if (!event) {
    return (
      <AppShell title="出店詳細">
        <div className="rounded-2xl border border-[#e8e1da] bg-white p-5 text-sm text-[#79716b]">読み込み中です。</div>
      </AppShell>
    );
  }

  return (
    <AppShell title={event.title} subtitle={`${formatDate(event.event_date)} / ${event.venue_name ?? "会場未設定"}`}>
      <section className="rounded-2xl border border-[#e8e1da] bg-white p-4 shadow-sm">
        <p className="text-xs font-bold text-[#d9643a]">出店情報</p>
        <h2 className="mt-2 text-2xl font-bold">{event.title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#79716b]">
          {[event.venue_name, event.area, event.genre].filter(Boolean).join(" / ") || "詳細未設定"}
        </p>
        <p className="mt-3 inline-flex rounded-full bg-[#fff0e9] px-3 py-1 text-xs font-bold text-[#8f3d22]">{event.status}</p>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-3">
        <StatCard label="売上" value={formatYen(totals.revenue)} tone="orange" />
        <StatCard label="経費" value={formatYen(totals.expense)} tone="navy" />
        <StatCard label="利益" value={formatYen(totals.profit)} tone="green" />
      </section>

      <CheckSection
        checks={checks}
        onAdd={async (title) => {
          await addCheckItem(profile, event.id, title);
          await load();
        }}
        onToggle={async (item, nextValue) => {
          await toggleCheckItem(profile, item, nextValue);
          await load();
        }}
      />

      <FinanceSection
        eventId={event.id}
        finances={finances}
        eventDate={event.event_date}
        onAdd={async (input) => {
          await addFinancialRecord(profile, input);
          await load();
        }}
      />

      <ReflectionSection
        eventId={event.id}
        reflection={reflection}
        onSave={async (input) => {
          await saveReflection(profile, input);
          await load();
          setMessage("振り返りを保存しました。");
        }}
      />

      {message ? <p className="mt-4 rounded-2xl bg-[#fff0e9] px-4 py-3 text-sm text-[#8f3d22]">{message}</p> : null}

      <button
        onClick={async () => {
          const updated = await completeMarketEvent(profile, event);
          setEvent(updated);
          setMessage("出店完了としてStoryに反映しました。");
        }}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d9643a] px-4 py-3 font-bold text-white"
      >
        <Flag size={20} /> 出店完了にする
      </button>
    </AppShell>
  );
}

function CheckSection({
  checks,
  onAdd,
  onToggle
}: {
  checks: MarketCheckItem[];
  onAdd: (title: string) => Promise<void>;
  onToggle: (item: MarketCheckItem, nextValue: boolean) => Promise<void>;
}) {
  const [title, setTitle] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    await onAdd(title.trim());
    setTitle("");
  }

  return (
    <section className="mt-5 rounded-2xl border border-[#e8e1da] bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold">準備チェック</h2>
      <div className="mt-3 space-y-2">
        {checks.map((item) => (
          <button
            key={item.id}
            onClick={() => onToggle(item, !item.is_done)}
            className="flex w-full items-center gap-3 rounded-xl bg-[#fbfaf8] px-3 py-3 text-left"
          >
            {item.is_done ? <CheckCircle2 className="text-[#4f8a61]" size={22} /> : <Circle className="text-[#c8bdb4]" size={22} />}
            <span className={item.is_done ? "text-[#79716b] line-through" : "font-semibold"}>{item.title}</span>
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="例: 釣り銭を準備"
          className="min-w-0 flex-1 rounded-xl border border-[#e8e1da] bg-[#fbfaf8] px-3 py-3"
        />
        <button className="rounded-xl bg-[#25211f] px-4 py-3 font-bold text-white">追加</button>
      </form>
    </section>
  );
}

function FinanceSection({
  eventId,
  finances,
  eventDate,
  onAdd
}: {
  eventId: string;
  finances: MarketFinancialRecord[];
  eventDate: string;
  onAdd: (input: {
    marketEventId: string;
    recordType: "revenue" | "expense";
    title: string;
    amount: number;
    occurredAt: string;
    category: string;
    memo: string;
  }) => Promise<void>;
}) {
  const [recordType, setRecordType] = useState<"revenue" | "expense">("revenue");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [memo, setMemo] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!title.trim() || !numericAmount) return;
    await onAdd({
      marketEventId: eventId,
      recordType,
      title: title.trim(),
      amount: numericAmount,
      occurredAt: eventDate,
      category,
      memo
    });
    setTitle("");
    setAmount("");
    setCategory("");
    setMemo("");
  }

  return (
    <section className="mt-5 rounded-2xl border border-[#e8e1da] bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold">売上・経費</h2>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#fbfaf8] p-1">
          {(["revenue", "expense"] as const).map((type) => (
            <button
              type="button"
              key={type}
              onClick={() => setRecordType(type)}
              className={`rounded-lg px-3 py-2 text-sm font-bold ${recordType === type ? "bg-white text-[#d9643a] shadow-sm" : "text-[#79716b]"}`}
            >
              {type === "revenue" ? "売上" : "経費"}
            </button>
          ))}
        </div>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="内容" className="w-full rounded-xl border border-[#e8e1da] bg-[#fbfaf8] px-3 py-3" />
        <input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" inputMode="numeric" placeholder="金額" className="w-full rounded-xl border border-[#e8e1da] bg-[#fbfaf8] px-3 py-3" />
        <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="カテゴリ" className="w-full rounded-xl border border-[#e8e1da] bg-[#fbfaf8] px-3 py-3" />
        <textarea value={memo} onChange={(event) => setMemo(event.target.value)} rows={3} placeholder="メモ" className="w-full rounded-xl border border-[#e8e1da] bg-[#fbfaf8] px-3 py-3" />
        <button className="w-full rounded-xl bg-[#25211f] px-4 py-3 font-bold text-white">記録する</button>
      </form>
      <div className="mt-4 space-y-2">
        {finances.map((row) => (
          <div key={row.id} className="flex items-center justify-between rounded-xl bg-[#fbfaf8] px-3 py-3">
            <div>
              <p className="font-bold">{row.title}</p>
              <p className="text-xs text-[#79716b]">{row.record_type === "revenue" ? "売上" : "経費"}</p>
            </div>
            <p className={row.record_type === "revenue" ? "font-bold text-[#d9643a]" : "font-bold text-[#243447]"}>{formatYen(row.amount)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReflectionSection({
  eventId,
  reflection,
  onSave
}: {
  eventId: string;
  reflection: MarketReflection | null;
  onSave: (input: {
    marketEventId: string;
    publicSummary: string;
    privateNote: string;
    goodPoints: string;
    nextActions: string;
  }) => Promise<void>;
}) {
  const [publicSummary, setPublicSummary] = useState(reflection?.public_summary ?? "");
  const [privateNote, setPrivateNote] = useState(reflection?.private_note ?? "");
  const [goodPoints, setGoodPoints] = useState(reflection?.good_points ?? "");
  const [nextActions, setNextActions] = useState(reflection?.next_actions ?? "");

  useEffect(() => {
    setPublicSummary(reflection?.public_summary ?? "");
    setPrivateNote(reflection?.private_note ?? "");
    setGoodPoints(reflection?.good_points ?? "");
    setNextActions(reflection?.next_actions ?? "");
  }, [reflection]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave({ marketEventId: eventId, publicSummary, privateNote, goodPoints, nextActions });
  }

  return (
    <section className="mt-5 rounded-2xl border border-[#e8e1da] bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold">振り返り</h2>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <textarea value={publicSummary} onChange={(event) => setPublicSummary(event.target.value)} rows={3} placeholder="Storyに出してよい振り返り" className="w-full rounded-xl border border-[#e8e1da] bg-[#fbfaf8] px-3 py-3" />
        <textarea value={goodPoints} onChange={(event) => setGoodPoints(event.target.value)} rows={3} placeholder="よかったこと" className="w-full rounded-xl border border-[#e8e1da] bg-[#fbfaf8] px-3 py-3" />
        <textarea value={nextActions} onChange={(event) => setNextActions(event.target.value)} rows={3} placeholder="次にやること" className="w-full rounded-xl border border-[#e8e1da] bg-[#fbfaf8] px-3 py-3" />
        <textarea value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} rows={3} placeholder="非公開メモ" className="w-full rounded-xl border border-[#e8e1da] bg-[#fbfaf8] px-3 py-3" />
        <button className="w-full rounded-xl bg-[#25211f] px-4 py-3 font-bold text-white">保存する</button>
      </form>
    </section>
  );
}

export default function MarketDetailPage() {
  return (
    <AuthGate>
      <MarketDetailContent />
    </AuthGate>
  );
}
