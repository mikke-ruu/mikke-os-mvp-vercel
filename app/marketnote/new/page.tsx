"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ChevronDown, Clock, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { addCheckItem, createMarketEvent } from "@/lib/marketnote";

const paymentMethods = ["現金", "QR", "カード", "ポイント", "その他"] as const;

function NewMarketEventContent() {
  const router = useRouter();
  const { profile } = useAuth();
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [status, setStatus] = useState<"planned" | "preparing">("preparing");
  const [meetTime, setMeetTime] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [venueName, setVenueName] = useState("");
  const [area, setArea] = useState("");
  const [publicNote, setPublicNote] = useState("");
  const [selectedPayments, setSelectedPayments] = useState<string[]>(["QR", "カード"]);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({ 現金: "500", QR: "1000", カード: "2000", ポイント: "0", その他: "0" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const paymentMemo = paymentMethods
        .filter((method) => selectedPayments.includes(method))
        .map((method) => `${method}:${paymentAmounts[method] || 0}円`)
        .join(" / ");
      const created = await createMarketEvent(profile, {
        title,
        eventDate,
        venueName,
        area,
        genre: "出店",
        status,
        publicNote,
        privateNote: [
          meetTime ? `集合時間: ${meetTime}` : "",
          startTime ? `開始時間: ${startTime}` : "",
          endTime ? `終了時間: ${endTime}` : "",
          paymentMemo ? `支払い方法: ${paymentMemo}` : ""
        ].filter(Boolean).join("\n")
      });

      await Promise.all([
        addCheckItem(profile, created.id, "支払い済み"),
        addCheckItem(profile, created.id, "アイキャッチ提出"),
        addCheckItem(profile, created.id, "持ち物確認"),
        addCheckItem(profile, created.id, "出店ブース確認")
      ]);

      router.replace(`/marketnote/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
      setSaving(false);
    }
  }

  function togglePayment(method: string) {
    setSelectedPayments((current) => current.includes(method) ? current.filter((item) => item !== method) : [...current, method]);
  }

  return (
    <AppShell title="出店予定を追加" subtitle="イベント名・開催日のみ必須">
      <form onSubmit={submit} className="space-y-5">
        <p className="text-center text-sm font-extrabold text-[#e8612c]">イベント名・開催日のみ必須</p>

        <SectionTitle title="基本情報" />
        <div className="rounded-2xl border border-[#eceae5] bg-white p-4 shadow-sm">
          <FieldLabel label="ステータス">
            <button
              type="button"
              onClick={() => setStatus(status === "preparing" ? "planned" : "preparing")}
              className="flex min-h-11 w-full items-center justify-between rounded-xl border border-[#e4ddd4] bg-white px-3 py-2"
            >
              <span className={`rounded-md border px-3 py-1 text-xs font-extrabold ${status === "preparing" ? "border-[#cfe6d2] bg-[#e6f1e7] text-[#2e7d46]" : "border-[#d3e1f2] bg-[#eaf1fa] text-[#3a6fb0]"}`}>
                {status === "preparing" ? "確定" : "検討中"}
              </span>
              <ChevronDown size={18} className="text-[#8a817a]" />
            </button>
          </FieldLabel>
          <FieldLabel label="イベント名" required>
            <Input value={title} onChange={setTitle} required placeholder="例）Mikke bazar vol.12" />
          </FieldLabel>
          <FieldLabel label="開催日" required>
            <Input value={eventDate} onChange={setEventDate} required type="date" icon={<CalendarDays size={18} />} />
          </FieldLabel>
          <FieldLabel label="集合時間">
            <Input value={meetTime} onChange={setMeetTime} type="time" icon={<Clock size={18} />} />
          </FieldLabel>
          <FieldLabel label="開始時間">
            <Input value={startTime} onChange={setStartTime} type="time" icon={<Clock size={18} />} />
          </FieldLabel>
          <FieldLabel label="終了時間">
            <Input value={endTime} onChange={setEndTime} type="time" icon={<Clock size={18} />} />
          </FieldLabel>
          <FieldLabel label="会場名">
            <Input value={venueName} onChange={setVenueName} placeholder="例）SILKROAD CAFE" />
          </FieldLabel>
          <FieldLabel label="住所">
            <Input value={area} onChange={setArea} placeholder="例）東京都墨田区太平3丁目2-8" />
          </FieldLabel>
          <FieldLabel label="詳細メモ" top>
            <textarea
              value={publicNote}
              onChange={(event) => setPublicNote(event.target.value)}
              rows={4}
              placeholder="ブース番号、注意事項など自由にメモできます"
              className="w-full rounded-xl border border-[#e4ddd4] bg-white px-3 py-3 text-sm outline-none focus:border-[#e8612c]"
            />
          </FieldLabel>
        </div>

        <SectionTitle title="支払い方法" sub="（複数選択可）" />
        <div className="rounded-2xl border border-[#eceae5] bg-white p-4 shadow-sm">
          <div className="grid gap-3">
            {paymentMethods.map((method) => {
              const checked = selectedPayments.includes(method);
              return (
                <div key={method} className="grid grid-cols-[28px_64px_1fr_96px] items-center gap-2">
                  <button
                    type="button"
                    onClick={() => togglePayment(method)}
                    aria-label={`${method}を選択`}
                    className={`grid h-5 w-5 place-items-center rounded border ${checked ? "border-[#e8612c] bg-[#e8612c] text-white" : "border-[#d6cec5] bg-white text-transparent"}`}
                  >
                    <Check size={13} />
                  </button>
                  <span className="text-sm font-bold text-[#433a34]">{method}</span>
                  <div className="flex h-10 items-center justify-center rounded-xl border border-[#e4ddd4] bg-white text-sm font-bold text-[#9b9088]">¥</div>
                  <input
                    value={paymentAmounts[method]}
                    onChange={(event) => setPaymentAmounts((current) => ({ ...current, [method]: event.target.value }))}
                    inputMode="numeric"
                    className="h-10 rounded-xl border border-[#e4ddd4] bg-white px-3 text-right text-sm font-bold text-[#5b514b] outline-none focus:border-[#e8612c]"
                  />
                </div>
              );
            })}
          </div>
          <button type="button" className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#f0c4ae] bg-white px-4 py-3 text-sm font-extrabold text-[#e8612c]">
            <Plus size={16} /> 支払い方法を追加
          </button>
          <p className="mt-3 text-xs font-semibold leading-5 text-[#9a9089]">支払い状況はこのフォームでは決めません。詳細画面のチェック「支払い済み」と連動します。</p>
        </div>

        {error ? <p className="rounded-2xl bg-[#fff0e9] px-4 py-3 text-sm text-[#8f3d22]">{error}</p> : null}
        <button disabled={saving} className="w-full rounded-2xl bg-[#e8612c] px-4 py-4 font-extrabold text-white disabled:opacity-60">
          {saving ? "保存中..." : "保存"}
        </button>
      </form>
    </AppShell>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-5 w-1 rounded-full bg-[#e8612c]" />
      <h2 className="text-base font-extrabold text-[#1f1b18]">{title}</h2>
      {sub ? <span className="text-xs font-bold text-[#9a9089]">{sub}</span> : null}
    </div>
  );
}

function FieldLabel({ label, required = false, top = false, children }: { label: string; required?: boolean; top?: boolean; children: React.ReactNode }) {
  return (
    <label className={`mt-3 grid grid-cols-[82px_1fr] gap-3 ${top ? "items-start" : "items-center"}`}>
      <span className={`text-xs font-extrabold text-[#453b35] ${top ? "pt-3" : ""}`}>
        {label}{required ? <span className="text-[#e8612c]">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  icon
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        required={required}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-xl border border-[#e4ddd4] bg-white px-3 py-3 pr-10 text-sm outline-none focus:border-[#e8612c]"
      />
      {icon ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8a817a]">{icon}</span> : null}
    </div>
  );
}

export default function NewMarketEventPage() {
  return (
    <AuthGate>
      <NewMarketEventContent />
    </AuthGate>
  );
}
