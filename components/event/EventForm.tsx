"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useMikkeEvents } from "@/lib/event/store";
import type { EventStatus, MikkeEvent } from "@/lib/event/types";
import { eventStatusLabels } from "@/lib/event/types";

const statusOptions: EventStatus[] = ["draft", "published", "finished", "cancelled"];

export function EventForm({ event }: { event?: MikkeEvent }) {
  const router = useRouter();
  const { createEvent, updateEvent } = useMikkeEvents();

  const [title, setTitle] = useState(event?.title ?? "");
  const [summary, setSummary] = useState(event?.summary ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [eventDate, setEventDate] = useState(event?.eventDate ?? "");
  const [startTime, setStartTime] = useState(event?.startTime ?? "");
  const [endTime, setEndTime] = useState(event?.endTime ?? "");
  const [venueName, setVenueName] = useState(event?.venueName ?? "");
  const [venueAddress, setVenueAddress] = useState(event?.venueAddress ?? "");
  const [mapUrl, setMapUrl] = useState(event?.mapUrl ?? "");
  const [feeLabel, setFeeLabel] = useState(event?.feeLabel ?? "参加費");
  const [feeAmount, setFeeAmount] = useState(event?.feeAmount != null ? String(event.feeAmount) : "");
  const [capacity, setCapacity] = useState(event?.capacity != null ? String(event.capacity) : "");
  const [applicationOpen, setApplicationOpen] = useState(event?.applicationOpen ?? true);
  const [status, setStatus] = useState<EventStatus>(event?.status ?? "draft");
  const [organizerNotice, setOrganizerNotice] = useState(event?.organizerNotice ?? "");
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0 && eventDate.length > 0 && !saving;

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!canSave) return;
    setSaving(true);

    const payload = {
      title: title.trim(),
      summary: summary.trim(),
      description: description.trim(),
      eventDate,
      startTime,
      endTime,
      venueName: venueName.trim(),
      venueAddress: venueAddress.trim(),
      mapUrl: mapUrl.trim(),
      coverImageUrl: event?.coverImageUrl ?? "",
      feeLabel: feeLabel.trim(),
      feeAmount: feeAmount ? Number(feeAmount) : null,
      capacity: capacity ? Number(capacity) : null,
      applicationOpen,
      status,
      organizerNotice: organizerNotice.trim()
    };

    if (event) {
      updateEvent(event.id, payload);
      router.replace(`/event/admin/${event.id}`);
    } else {
      const created = createEvent(payload);
      router.replace(`/event/admin/${created.id}`);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="イベント名" required>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
      </Field>
      <Field label="概要（一覧・LP用の短い説明）">
        <input value={summary} onChange={(e) => setSummary(e.target.value)} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="開催日" required>
          <input value={eventDate} onChange={(e) => setEventDate(e.target.value)} type="date" required className={inputClass} />
        </Field>
        <Field label="ステータス">
          <select value={status} onChange={(e) => setStatus(e.target.value as EventStatus)} className={inputClass}>
            {statusOptions.map((option) => (
              <option key={option} value={option}>{eventStatusLabels[option]}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="開始時間">
          <input value={startTime} onChange={(e) => setStartTime(e.target.value)} type="time" className={inputClass} />
        </Field>
        <Field label="終了時間">
          <input value={endTime} onChange={(e) => setEndTime(e.target.value)} type="time" className={inputClass} />
        </Field>
      </div>
      <Field label="会場名">
        <input value={venueName} onChange={(e) => setVenueName(e.target.value)} className={inputClass} />
      </Field>
      <Field label="住所">
        <input value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} className={inputClass} />
      </Field>
      <Field label="地図リンク（任意）">
        <input value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="https://..." className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="参加費の項目名">
          <input value={feeLabel} onChange={(e) => setFeeLabel(e.target.value)} className={inputClass} />
        </Field>
        <Field label="参加費（円）">
          <input value={feeAmount} onChange={(e) => setFeeAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputClass} />
        </Field>
      </div>
      <Field label="定員（任意）">
        <input value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-sm font-semibold text-[var(--mikke-text)]">
        <input type="checkbox" checked={applicationOpen} onChange={(e) => setApplicationOpen(e.target.checked)} />
        申込を受け付ける
      </label>
      <Field label="詳細（公開ページに表示）">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className={`${inputClass} resize-none`} />
      </Field>
      <Field label="申込者へのお知らせ（任意）">
        <textarea value={organizerNotice} onChange={(e) => setOrganizerNotice(e.target.value)} rows={3} className={`${inputClass} resize-none`} />
      </Field>

      <button
        type="submit"
        disabled={!canSave}
        className="w-full rounded-full bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
      >
        {saving ? "保存しています…" : event ? "変更を保存" : "イベントを作成"}
      </button>
    </form>
  );
}

const inputClass =
  "mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--mikke-accent)]";

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-[var(--mikke-text)]">
        {label}
        {required ? <span className="ml-1 text-[var(--mikke-accent)]">*</span> : null}
      </span>
      {children}
    </label>
  );
}
