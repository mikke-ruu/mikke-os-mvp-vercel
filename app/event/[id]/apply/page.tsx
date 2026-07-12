"use client";

import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { EventPublicShell } from "@/components/event/EventPublicShell";
import { formatMonthDayWeekday } from "@/lib/format";
import { useMikkeEvents } from "@/lib/event/store";

export default function EventApplyPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { events, createApplication } = useMikkeEvents();
  const event = events.find((item) => item.id === params.id);

  const [applicantName, setApplicantName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [genre, setGenre] = useState("");
  const [applicationNote, setApplicationNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!event) {
    return (
      <EventPublicShell title="Event" backHref="/event">
        <p className="text-sm text-[var(--mikke-muted)]">このイベントは見つかりませんでした。</p>
      </EventPublicShell>
    );
  }

  const canSave = applicantName.trim().length > 0 && contactEmail.trim().length > 0 && !saving;

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!canSave || !event) return;
    setSaving(true);

    createApplication({
      eventId: event.id,
      applicantName: applicantName.trim(),
      contactEmail: contactEmail.trim(),
      phone: phone.trim(),
      instagram: instagram.trim(),
      websiteUrl: websiteUrl.trim(),
      genre: genre.trim(),
      applicationNote: applicationNote.trim(),
      feeAmount: event.feeAmount,
      paymentStatus: event.feeAmount ? "unpaid" : "not_required"
    });

    router.replace(`/event/${event.id}/apply/complete`);
  }

  return (
    <EventPublicShell title="Event" backHref={`/event/${event.id}`}>
      <h1 className="text-xl font-bold tracking-normal text-[var(--mikke-text)]">申込フォーム</h1>
      <p className="mt-1 text-sm font-semibold text-[var(--mikke-muted)]">
        {event.title}（{formatMonthDayWeekday(event.eventDate)}）
      </p>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <Field label="お名前 / 屋号" required>
          <input value={applicantName} onChange={(e) => setApplicantName(e.target.value)} required className={inputClass} />
        </Field>
        <Field label="メールアドレス" required>
          <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} type="email" required className={inputClass} />
        </Field>
        <Field label="電話番号">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Instagram">
          <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@..." className={inputClass} />
        </Field>
        <Field label="ウェブサイト / ショップURL">
          <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className={inputClass} />
        </Field>
        <Field label="ジャンル">
          <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="例：アクセサリー" className={inputClass} />
        </Field>
        <Field label="メッセージ・備考">
          <textarea value={applicationNote} onChange={(e) => setApplicationNote(e.target.value)} rows={4} className={`${inputClass} resize-none`} />
        </Field>

        <button
          type="submit"
          disabled={!canSave}
          className="w-full rounded-full bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
        >
          {saving ? "送信しています…" : "この内容で申し込む"}
        </button>
      </form>
    </EventPublicShell>
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
