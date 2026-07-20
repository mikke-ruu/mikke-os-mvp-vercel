"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getListedInstructor, getPublicCourse, submitPublicApplication } from "@/lib/academy/lp";
import type { AcademyCourse, AcademyInstructor } from "@/types/database";

const inputClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";
const labelClass = "block text-xs font-bold text-[var(--mikke-text-soft)]";

// AC-D6: 外部決済URLへメールを事前入力できる場合だけ付与する（努力目標。対応可否はサービス次第）
function buildPaymentUrl(url: string, email: string): string {
  try {
    const u = new URL(url);
    if (email.trim()) u.searchParams.set("prefilled_email", email.trim());
    return u.toString();
  } catch {
    return url;
  }
}

function ApplyInner({ courseId }: { courseId: string }) {
  const searchParams = useSearchParams();
  const instructorId = searchParams.get("k");
  const [course, setCourse] = useState<AcademyCourse | null>(null);
  const [instructor, setInstructor] = useState<AcademyInstructor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [format, setFormat] = useState<"in_person" | "online" | "">("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Wave E (AC-E2): ディプロマ用の英語表記名（必須）・オンライン受講時のみの配送先。
  const [diplomaNameEn, setDiplomaNameEn] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");

  useEffect(() => {
    async function load() {
      const c = await getPublicCourse(courseId);
      setCourse(c);
      if (c && instructorId) setInstructor(await getListedInstructor(instructorId).catch(() => null));
      setLoading(false);
    }
    load();
  }, [courseId, instructorId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!course) return;
    if (!name.trim()) return setError("お名前を入力してください。");
    if (!diplomaNameEn.trim()) return setError("ディプロマに入れるお名前（英語表記）を入力してください。");
    if (format === "online" && !shippingAddress.trim()) return setError("オンライン受講の場合は配送先情報を入力してください。");
    setSaving(true);
    try {
      await submitPublicApplication({
        course,
        instructorId: instructor ? instructor.id : null,
        applicantName: name,
        applicantEmail: email,
        applicantPhone: phone,
        applicantNote: note,
        eventDate,
        format,
        formAnswers: answers,
        diplomaNameEn,
        applicantShippingAddress: format === "online" ? shippingAddress : ""
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信に失敗しました。時間をおいて再度お試しください。");
      setSaving(false);
    }
  }

  if (loading) return <p className="py-20 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!course || !course.is_published) {
    return <p className="py-20 text-center text-sm text-[var(--mikke-muted)]">この講座は現在申込を受け付けていません。</p>;
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <p className="text-lg font-bold text-[var(--mikke-text)]">お申込みありがとうございます</p>
        <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">
          {course.name} のお申込みを受け付けました。担当より折り返しご連絡いたします。
        </p>
        {course.payment_url ? (
          <a
            href={buildPaymentUrl(course.payment_url, email)}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-block rounded-2xl bg-[var(--mikke-accent)] px-5 py-3 text-sm font-bold text-white"
          >
            お支払い手続きへ進む
          </a>
        ) : null}
        <Link href={`/academy/c/${course.id}${instructorId ? `?k=${instructorId}` : ""}`} className="mt-6 block text-sm font-bold text-[var(--mikke-accent-strong)]">
          講座ページに戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 py-6 md:max-w-lg md:rounded-3xl md:bg-white md:px-10 md:py-10 md:shadow-sm">
      <p className="text-xs font-bold tracking-widest text-[var(--mikke-accent-strong)]">{course.code} {course.name}</p>
      <h1 className="mt-1 text-xl font-bold text-[var(--mikke-text)] md:text-2xl">講座お申込み</h1>
      <p className="mt-1 text-xs text-[var(--mikke-muted)]">
        {instructor ? `講師: ${instructor.business_name || "認定講師"}（講師受付）` : "本部受付"} ・ 受講料 {course.price.toLocaleString()}円
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className={labelClass}>お名前*</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>メール</label>
            <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>電話</label>
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <p className="text-[11px] leading-5 text-[var(--mikke-muted)]">
          既にmikkeIDをお持ちの方は、そのログインメールアドレスでお申込みください。受講後、このメールアドレスで講師ページにログインできます。
        </p>
        <div>
          <label className={labelClass}>ディプロマに入れるお名前（英語表記）*</label>
          <input
            className={inputClass}
            value={diplomaNameEn}
            onChange={(e) => setDiplomaNameEn(e.target.value)}
            placeholder="例: Taro Yamada"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>受講希望日</label>
            <input type="date" className={inputClass} value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>受講形式</label>
            <select className={inputClass} value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
              <option value="">希望なし</option>
              {course.formats.includes("in_person") ? <option value="in_person">対面</option> : null}
              {course.formats.includes("online") ? <option value="online">オンライン</option> : null}
            </select>
          </div>
        </div>

        {format === "online" ? (
          <div>
            <label className={labelClass}>配送先情報*</label>
            <textarea
              className={`${inputClass} min-h-16`}
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              placeholder="キットのお届け先（郵便番号・ご住所・お名前）"
            />
          </div>
        ) : null}

        {course.application_form_fields.map((field) => (
          <div key={field.key}>
            <label className={labelClass}>
              {field.label}
              {field.required ? "*" : ""}
            </label>
            {field.type === "textarea" ? (
              <textarea
                className={`${inputClass} min-h-16`}
                required={field.required}
                value={answers[field.key] ?? ""}
                onChange={(e) => setAnswers((p) => ({ ...p, [field.key]: e.target.value }))}
              />
            ) : field.type === "select" ? (
              <select
                className={inputClass}
                required={field.required}
                value={answers[field.key] ?? ""}
                onChange={(e) => setAnswers((p) => ({ ...p, [field.key]: e.target.value }))}
              >
                <option value="">選択してください</option>
                {(field.options ?? []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                type={field.type === "email" ? "email" : field.type === "tel" ? "tel" : "text"}
                className={inputClass}
                required={field.required}
                value={answers[field.key] ?? ""}
                onChange={(e) => setAnswers((p) => ({ ...p, [field.key]: e.target.value }))}
              />
            )}
          </div>
        ))}

        <div>
          <label className={labelClass}>ご質問・ご要望</label>
          <textarea className={`${inputClass} min-h-16`} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {error ? <p className="text-sm font-bold text-[var(--mikke-danger)]">{error}</p> : null}

        <button type="submit" disabled={saving} className="w-full rounded-2xl bg-[var(--mikke-accent)] py-3 text-sm font-bold text-white disabled:opacity-60">
          {saving ? "送信中…" : "申し込む"}
        </button>
        <p className="text-[11px] text-[var(--mikke-muted)]">送信後、担当より折り返しご連絡します。お支払いは案内に従ってお手続きください。</p>
      </form>
    </div>
  );
}

export default function ApplyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <main className="min-h-screen bg-[var(--mikke-surface-soft)] md:py-10">
      <Suspense fallback={<p className="py-20 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>}>
        <ApplyInner courseId={id} />
      </Suspense>
    </main>
  );
}
