"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Banknote,
  Camera,
  Check,
  Circle,
  Clock,
  CreditCard,
  MapPin,
  Minus,
  MoreHorizontal,
  Plus,
  QrCode,
  WalletCards
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { formatDate, formatYen } from "@/lib/format";
import {
  addCheckItem,
  addFinancialRecord,
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
    return { revenue, expense };
  }, [finances]);

  if (!event) {
    return (
      <AppShell title="出店詳細">
        <div className="rounded-2xl border border-[#e8e1da] bg-white p-5 text-sm text-[#79716b]">読み込み中です。</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="出店詳細" subtitle={event.title}>
      <BasicInfo event={event} />

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

      <PaymentSection event={event} checks={checks} />

      <MoneySection
        title="経費"
        total={totals.expense}
        recordType="expense"
        eventId={event.id}
        eventDate={event.event_date}
        records={finances.filter((row) => row.record_type === "expense")}
        onAdd={async (input) => {
          await addFinancialRecord(profile, input);
          await load();
        }}
      />

      <MoneySection
        title="売上"
        total={totals.revenue}
        recordType="revenue"
        eventId={event.id}
        eventDate={event.event_date}
        records={finances.filter((row) => row.record_type === "revenue")}
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
          setMessage("Diary / 振り返りを保存しました。");
        }}
      />

      {message ? <p className="mt-4 rounded-2xl bg-[#fff0e9] px-4 py-3 text-sm font-semibold text-[#8f3d22]">{message}</p> : null}
    </AppShell>
  );
}

function BasicInfo({ event }: { event: MarketEvent }) {
  return (
    <section className="rounded-2xl border border-[#eceae5] bg-white p-4 shadow-sm">
      <StatusBadge status={event.status} />
      <h2 className="mt-3 text-2xl font-black tracking-normal text-[#1f1b18]">{event.title}</h2>
      <div className="mt-3 grid gap-2 text-sm font-semibold text-[#4a423c]">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-[#9a9089]" />
          <span>{formatDate(event.event_date)} / 時間未設定</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-[#9a9089]" />
          <span>{[event.venue_name, event.area].filter(Boolean).join("（") || "会場未設定"}</span>
        </div>
      </div>
      {event.public_note ? <p className="mt-3 rounded-xl bg-[#fcfbf9] p-3 text-sm leading-6 text-[#4a423c]">{event.public_note}</p> : null}
    </section>
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
  const done = checks.filter((check) => check.is_done).length;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    await onAdd(title.trim());
    setTitle("");
  }

  return (
    <section className="mt-4 rounded-2xl border border-[#eceae5] bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">チェック</h2>
        <span className="text-xs font-bold text-[#9a9089]">{checks.length}件中 {done}件完了</span>
      </div>
      <div>
        {checks.map((item) => (
          <button key={item.id} onClick={() => onToggle(item, !item.is_done)} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-[#f2efea] py-3 text-left last:border-b-0">
            <span className={`grid h-6 w-6 place-items-center rounded-full ${item.is_done ? "bg-[#2e8b57] text-white" : "bg-white text-[#d6cec5] ring-1 ring-[#d6cec5]"}`}>
              {item.is_done ? <Check size={14} /> : item.title.includes("提出") || item.title.includes("確認") ? <Minus size={14} className="text-[#e8612c]" /> : <Circle size={14} />}
            </span>
            <span className={`text-sm font-bold ${item.is_done ? "text-[#6b635c]" : "text-[#1f1b18]"}`}>{item.title}</span>
            {item.due_date ? <span className="text-xs font-extrabold text-[#e8612c]">期限 {shortDate(item.due_date)}</span> : null}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="追加チェック項目" className="min-w-0 flex-1 rounded-xl border border-[#e8e1da] bg-[#fbfaf8] px-3 py-3 text-sm" />
        <button className="rounded-xl border border-[#f0c4ae] px-4 py-3 font-extrabold text-[#e8612c]"><Plus size={18} /></button>
      </form>
    </section>
  );
}

function PaymentSection({ checks }: { event: MarketEvent; checks: MarketCheckItem[] }) {
  const paymentCheck = checks.find((check) => check.title.includes("支払い"));
  const paid = paymentCheck?.is_done ?? false;
  const methods = [
    { label: "現金", icon: Banknote, amount: 0 },
    { label: "QR", icon: QrCode, amount: 0 },
    { label: "カード", icon: CreditCard, amount: 0 },
    { label: "ポイント", icon: WalletCards, amount: 0 },
    { label: "その他", icon: MoreHorizontal, amount: 0 }
  ];

  return (
    <section className="mt-4 rounded-2xl border border-[#eceae5] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">支払い情報</h2>
        <span className={`rounded-md border px-2 py-1 text-xs font-extrabold ${paid ? "border-[#cfe6d2] bg-[#e6f1e7] text-[#2e7d46]" : "border-[#f2cfc6] bg-[#fcebe7] text-[#d94a2f]"}`}>
          {paid ? "支払い済み" : "未払い"}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {methods.map((method) => {
          const Icon = method.icon;
          return (
            <div key={method.label} className="rounded-xl border border-[#eceae5] p-2 text-center">
              <Icon size={18} className="mx-auto text-[#6b635c]" />
              <span className="mt-1 block text-[10px] font-bold text-[#6b635c]">{method.label}</span>
              <span className="mt-1 block text-xs font-extrabold text-[#a39a92]">{formatYen(method.amount)}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-[#9a9089]">支払い方法は複数併用できます。支払い状況はチェック欄の「支払い済み」で管理します。</p>
    </section>
  );
}

function MoneySection({
  title,
  total,
  recordType,
  eventId,
  eventDate,
  records,
  onAdd
}: {
  title: "経費" | "売上";
  total: number;
  recordType: "revenue" | "expense";
  eventId: string;
  eventDate: string;
  records: MarketFinancialRecord[];
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
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!name.trim() || !numericAmount) return;
    await onAdd({ marketEventId: eventId, recordType, title: name.trim(), amount: numericAmount, occurredAt: eventDate, category: title, memo: "" });
    setName("");
    setAmount("");
  }

  return (
    <section className="mt-4 rounded-2xl border border-[#eceae5] bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-extrabold">{title}</h2>
        <span className="text-xs font-bold text-[#6b635c]">合計 {formatYen(total)}</span>
      </div>
      <div>
        {records.map((row) => (
          <div key={row.id} className="flex items-center justify-between border-b border-[#f2efea] py-3 last:border-b-0">
            <span className="text-sm font-bold">{row.title}</span>
            <span className="text-sm font-extrabold">{formatYen(row.amount)}</span>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="mt-3 grid grid-cols-[1fr_92px_auto] gap-2">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder={`${title}名`} className="min-w-0 rounded-xl border border-[#e8e1da] bg-[#fbfaf8] px-3 py-3 text-sm" />
        <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" placeholder="金額" className="min-w-0 rounded-xl border border-[#e8e1da] bg-[#fbfaf8] px-3 py-3 text-sm" />
        <button className="rounded-xl border border-[#f0c4ae] px-3 py-3 text-[#e8612c]"><Plus size={18} /></button>
      </form>
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
    <section className="mt-4 rounded-2xl border border-[#eceae5] bg-white p-4 shadow-sm">
      <h2 className="text-lg font-extrabold">Diary / 振り返り</h2>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <textarea value={publicSummary} onChange={(event) => setPublicSummary(event.target.value)} rows={3} placeholder="天気、客足、よく売れたものなど" className="w-full rounded-xl border border-[#e8e1da] bg-[#fcfbf9] px-3 py-3 text-sm leading-6" />
        <textarea value={goodPoints} onChange={(event) => setGoodPoints(event.target.value)} rows={2} placeholder="よかったこと" className="w-full rounded-xl border border-[#e8e1da] bg-[#fcfbf9] px-3 py-3 text-sm leading-6" />
        <textarea value={nextActions} onChange={(event) => setNextActions(event.target.value)} rows={2} placeholder="次に試すこと" className="w-full rounded-xl border border-[#e8e1da] bg-[#fcfbf9] px-3 py-3 text-sm leading-6" />
        <textarea value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} rows={2} placeholder="非公開メモ" className="w-full rounded-xl border border-[#e8e1da] bg-[#fcfbf9] px-3 py-3 text-sm leading-6" />
        <div className="grid grid-cols-4 gap-2">
          <div className="aspect-square rounded-xl bg-[#e8dcc9]" />
          <div className="aspect-square rounded-xl bg-[#dcc9b6]" />
          <div className="aspect-square rounded-xl bg-[#e9cfa8]" />
          <button type="button" className="grid aspect-square place-items-center rounded-xl border border-dashed border-[#d6cec5] text-[#a39a92]">
            <span className="grid place-items-center gap-1 text-[10px] font-bold"><Camera size={20} />写真を追加</span>
          </button>
        </div>
        <button className="w-full rounded-xl bg-[#e8612c] px-4 py-3 font-extrabold text-white">保存する</button>
      </form>
    </section>
  );
}

function StatusBadge({ status }: { status: MarketEvent["status"] }) {
  const label = status === "completed" ? "終了" : status === "preparing" ? "確定" : status === "cancelled" ? "中止" : "検討中";
  const tone = status === "preparing" ? "border-[#cfe6d2] bg-[#e6f1e7] text-[#2e7d46]" : status === "planned" ? "border-[#d3e1f2] bg-[#eaf1fa] text-[#3a6fb0]" : "border-[#e4ddd4] bg-[#f1eeea] text-[#8a817a]";
  return <span className={`inline-flex rounded-md border px-3 py-1 text-xs font-extrabold ${tone}`}>{label}</span>;
}

function shortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function MarketDetailPage() {
  return (
    <AuthGate>
      <MarketDetailContent />
    </AuthGate>
  );
}
