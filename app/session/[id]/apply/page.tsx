"use client";

import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SessionPublicShell } from "@/components/session/SessionPublicShell";
import { useSessionMenus } from "@/lib/session/store";

type Step = "form" | "confirm";

export default function SessionApplyPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { menus, createBooking } = useSessionMenus();
  const menu = menus.find((item) => item.id === params.id);

  const [step, setStep] = useState<Step>("form");
  const [applicantName, setApplicantName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactNote, setContactNote] = useState("");
  const [requestDetail, setRequestDetail] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [saving, setSaving] = useState(false);

  if (!menu) {
    return (
      <SessionPublicShell title="Session" backHref="/session">
        <p className="text-sm text-[var(--mikke-muted)]">このメニューは見つかりませんでした。</p>
      </SessionPublicShell>
    );
  }

  const canProceed = applicantName.trim().length > 0 && contactEmail.trim().length > 0 && bookingDate.length > 0;

  function goToConfirm(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!canProceed) return;
    setStep("confirm");
  }

  function submit() {
    if (!menu) return;
    setSaving(true);
    createBooking({
      menuId: menu.id,
      applicantName: applicantName.trim(),
      contactEmail: contactEmail.trim(),
      contactNote: contactNote.trim(),
      requestDetail: requestDetail.trim(),
      bookingDate,
      bookingTime
    });
    router.replace(`/session/${menu.id}/apply/complete`);
  }

  return (
    <SessionPublicShell title="Session" backHref={step === "confirm" ? undefined : `/session/${menu.id}`}>
      <h1 className="text-xl font-bold tracking-normal text-[var(--mikke-text)]">
        {step === "form" ? "予約フォーム" : "内容の確認"}
      </h1>
      <p className="mt-1 text-sm font-semibold text-[var(--mikke-muted)]">{menu.title}</p>

      {step === "form" ? (
        <form onSubmit={goToConfirm} className="mt-5 space-y-4">
          <Field label="お名前" required>
            <input value={applicantName} onChange={(e) => setApplicantName(e.target.value)} required className={inputClass} />
          </Field>
          <Field label="メールアドレス" required>
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} type="email" required className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="希望日" required>
              <input value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} type="date" required className={inputClass} />
            </Field>
            <Field label="希望時間（任意）">
              <input value={bookingTime} onChange={(e) => setBookingTime(e.target.value)} type="time" className={inputClass} />
            </Field>
          </div>
          <Field label="連絡方法の補足（任意）">
            <input value={contactNote} onChange={(e) => setContactNote(e.target.value)} placeholder="電話番号・LINEなど" className={inputClass} />
          </Field>
          <Field label="ご相談内容（任意）">
            <textarea value={requestDetail} onChange={(e) => setRequestDetail(e.target.value)} rows={4} className={`${inputClass} resize-none`} />
          </Field>

          <button
            type="submit"
            disabled={!canProceed}
            className="w-full rounded-full bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
          >
            確認画面へ
          </button>
        </form>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="space-y-2 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 text-sm text-[var(--mikke-text-soft)]">
            <ConfirmRow label="お名前" value={applicantName} />
            <ConfirmRow label="メールアドレス" value={contactEmail} />
            <ConfirmRow label="希望日時" value={`${bookingDate}${bookingTime ? ` ${bookingTime}` : ""}`} />
            {contactNote ? <ConfirmRow label="連絡方法の補足" value={contactNote} /> : null}
            {requestDetail ? <ConfirmRow label="ご相談内容" value={requestDetail} /> : null}
          </div>
          <p className="text-xs font-semibold text-[var(--mikke-muted)]">
            ※この時点では仮予約です。主催者の確認後に正式決定となります。
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("form")}
              className="flex-1 rounded-full border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-4 py-3 text-sm font-bold text-[var(--mikke-text-soft)]"
            >
              内容を修正する
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="flex-1 rounded-full bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
            >
              {saving ? "送信しています…" : "この内容で予約する"}
            </button>
          </div>
        </div>
      )}
    </SessionPublicShell>
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

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="block text-xs font-bold text-[var(--mikke-muted)]">{label}</span>
      <span className="mt-0.5 block whitespace-pre-wrap font-semibold text-[var(--mikke-text)]">{value}</span>
    </p>
  );
}
