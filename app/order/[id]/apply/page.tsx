"use client";

import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { OrderPublicShell } from "@/components/order/OrderPublicShell";
import { useOrderMenus } from "@/lib/order/store";

type Step = "form" | "confirm";

export default function OrderApplyPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { menus, createApplication } = useOrderMenus();
  const menu = menus.find((item) => item.id === params.id);

  const [step, setStep] = useState<Step>("form");
  const [applicantName, setApplicantName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactNote, setContactNote] = useState("");
  const [requestDetail, setRequestDetail] = useState("");
  const [desiredDueDate, setDesiredDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  if (!menu) {
    return (
      <OrderPublicShell title="Order" backHref="/order">
        <p className="text-sm text-[var(--mikke-muted)]">このメニューは見つかりませんでした。</p>
      </OrderPublicShell>
    );
  }

  const canProceed = applicantName.trim().length > 0 && contactEmail.trim().length > 0;

  function goToConfirm(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!canProceed) return;
    setStep("confirm");
  }

  function submit() {
    if (!menu) return;
    setSaving(true);
    createApplication({
      menuId: menu.id,
      applicantName: applicantName.trim(),
      contactEmail: contactEmail.trim(),
      contactNote: contactNote.trim(),
      requestDetail: requestDetail.trim(),
      desiredDueDate
    });
    router.replace(`/order/${menu.id}/apply/complete`);
  }

  return (
    <OrderPublicShell title="Order" backHref={step === "confirm" ? undefined : `/order/${menu.id}`}>
      <h1 className="text-xl font-bold tracking-normal text-[var(--mikke-text)]">
        {step === "form" ? "申込フォーム" : "内容の確認"}
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
          <Field label="連絡方法の補足（任意）">
            <input value={contactNote} onChange={(e) => setContactNote(e.target.value)} placeholder="電話番号・LINEなど" className={inputClass} />
          </Field>
          <Field label="ご相談・ご依頼内容">
            <textarea value={requestDetail} onChange={(e) => setRequestDetail(e.target.value)} rows={5} className={`${inputClass} resize-none`} />
          </Field>
          <Field label="希望納期（任意）">
            <input value={desiredDueDate} onChange={(e) => setDesiredDueDate(e.target.value)} type="date" className={inputClass} />
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
            {contactNote ? <ConfirmRow label="連絡方法の補足" value={contactNote} /> : null}
            {requestDetail ? <ConfirmRow label="ご相談・ご依頼内容" value={requestDetail} /> : null}
            {desiredDueDate ? <ConfirmRow label="希望納期" value={desiredDueDate} /> : null}
          </div>

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
              {saving ? "送信しています…" : "この内容で申し込む"}
            </button>
          </div>
        </div>
      )}
    </OrderPublicShell>
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
