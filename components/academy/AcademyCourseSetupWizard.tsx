"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { DEFAULT_ACADEMY_COURSE_FEATURE_SETTINGS } from "@/lib/academy/course-feature-settings";
import type { CourseInput } from "@/lib/academy/courses";

type WizardAnswers = {
  code: string;
  name: string;
  purpose: string;
  formats: ("in_person" | "online")[];
  durationText: string;
  intake: "honbu" | "koushi" | "both";
  materialType: "none" | "digital" | "physical";
  certification: boolean;
  price: string;
  paymentProvider: CourseInput["paymentProvider"];
};

const inputClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";
const optionClass =
  "rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-3 text-left text-sm font-bold text-[var(--mikke-text-soft)]";

const initialAnswers: WizardAnswers = {
  code: "",
  name: "",
  purpose: "",
  formats: [],
  durationText: "",
  intake: "honbu",
  materialType: "none",
  certification: true,
  price: "",
  paymentProvider: "manual"
};

export function AcademyCourseSetupWizard({ onComplete }: { onComplete: (initial: Partial<CourseInput>) => void }) {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState(initialAnswers);

  function complete() {
    const physicalMaterials = answers.materialType === "physical";
    onComplete({
      code: answers.code.trim(),
      name: answers.name.trim(),
      description: answers.purpose.trim(),
      formats: answers.formats,
      durationText: answers.durationText.trim(),
      acceptAtHonbu: answers.intake !== "koushi",
      acceptAtKoushi: answers.intake !== "honbu",
      materialContents:
        answers.materialType === "digital"
          ? "デジタル教材（詳細は次の画面で設定）"
          : physicalMaterials
            ? "現物教材（詳細は次の画面で設定）"
            : "",
      requiresKit: physicalMaterials,
      price: Number(answers.price) || 0,
      paymentProvider: answers.paymentProvider,
      featureSettings: {
        ...DEFAULT_ACADEMY_COURSE_FEATURE_SETTINGS,
        kits: physicalMaterials,
        certification: answers.certification,
        renewal: answers.certification,
        portal: {
          ...DEFAULT_ACADEMY_COURSE_FEATURE_SETTINGS.portal,
          kits: physicalMaterials,
          procurement: physicalMaterials,
          credentials: answers.certification
        }
      }
    });
  }

  const canContinue =
    step === 1 ? Boolean(answers.code.trim() && answers.name.trim())
      : step === 2 ? Boolean(answers.purpose.trim())
        : step === 3 ? answers.formats.length > 0
          : step === 6 ? answers.price !== "" && Number(answers.price) >= 0
            : true;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--mikke-accent)]/35 bg-[var(--mikke-accent-soft)] p-4">
        <p className="text-xs font-bold text-[var(--mikke-accent-strong)]">講座づくり {step}/6</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-[var(--mikke-accent)] transition-all" style={{ width: `${(step / 6) * 100}%` }} />
        </div>
        <p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]">一問ずつ答えると、必要な設定だけを入れた下書きを作ります。この段階では公開されません。</p>
      </div>

      <section className="min-h-72 space-y-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-5">
        {step === 1 ? (
          <>
            <h2 className="text-base font-bold">まず、どの講座を作りますか？</h2>
            <label className="block text-xs font-bold">講座名*<input className={inputClass} value={answers.name} onChange={(e) => setAnswers({ ...answers, name: e.target.value })} placeholder="スキルビジネス構築コース" /></label>
            <label className="block text-xs font-bold">講座コード*<input className={inputClass} value={answers.code} onChange={(e) => setAnswers({ ...answers, code: e.target.value })} placeholder="MUSUBI-01" /></label>
          </>
        ) : null}
        {step === 2 ? (
          <>
            <h2 className="text-base font-bold">誰の、どんな変化を支える講座ですか？</h2>
            <textarea className={`${inputClass} min-h-36`} value={answers.purpose} onChange={(e) => setAnswers({ ...answers, purpose: e.target.value })} placeholder="対象者、悩み、受講後にできるようになることを書いてください。" />
          </>
        ) : null}
        {step === 3 ? (
          <>
            <h2 className="text-base font-bold">どの方法で開催しますか？</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["in_person", "online"] as const).map((format) => (
                <button key={format} type="button" onClick={() => setAnswers({ ...answers, formats: answers.formats.includes(format) ? answers.formats.filter((item) => item !== format) : [...answers.formats, format] })} className={`${optionClass} ${answers.formats.includes(format) ? "border-[var(--mikke-accent)] bg-[var(--mikke-accent-soft)]" : ""}`}>
                  {format === "in_person" ? "対面で開催" : "オンラインで開催"}
                </button>
              ))}
            </div>
            <label className="block text-xs font-bold">所要時間<input className={inputClass} value={answers.durationText} onChange={(e) => setAnswers({ ...answers, durationText: e.target.value })} placeholder="約3時間 / 6週間など" /></label>
          </>
        ) : null}
        {step === 4 ? (
          <>
            <h2 className="text-base font-bold">誰が申込を受け付けますか？</h2>
            <div className="grid gap-2">
              {([['honbu', '本部が受け付ける'], ['koushi', '講師が受け付ける'], ['both', '本部と講師の両方']] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setAnswers({ ...answers, intake: value })} className={`${optionClass} ${answers.intake === value ? "border-[var(--mikke-accent)] bg-[var(--mikke-accent-soft)]" : ""}`}>{label}</button>
              ))}
            </div>
          </>
        ) : null}
        {step === 5 ? (
          <>
            <h2 className="text-base font-bold">教材と認定は必要ですか？</h2>
            <p className="text-xs font-bold">教材</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {([['none', 'なし'], ['digital', 'デジタル教材'], ['physical', '現物教材']] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setAnswers({ ...answers, materialType: value })} className={`${optionClass} ${answers.materialType === value ? "border-[var(--mikke-accent)] bg-[var(--mikke-accent-soft)]" : ""}`}>{label}</button>
              ))}
            </div>
            <label className="flex items-center justify-between rounded-xl border border-[var(--mikke-line)] px-4 py-3 text-sm font-bold">修了後に認定する<input type="checkbox" checked={answers.certification} onChange={(e) => setAnswers({ ...answers, certification: e.target.checked })} /></label>
          </>
        ) : null}
        {step === 6 ? (
          <>
            <h2 className="text-base font-bold">受講料と支払方法はどうしますか？</h2>
            <label className="block text-xs font-bold">受講料（円）*<input type="number" min="0" className={inputClass} value={answers.price} onChange={(e) => setAnswers({ ...answers, price: e.target.value })} /></label>
            <label className="block text-xs font-bold">支払方法<select className={inputClass} value={answers.paymentProvider} onChange={(e) => setAnswers({ ...answers, paymentProvider: e.target.value as CourseInput["paymentProvider"] })}><option value="manual">銀行振込・現金など</option><option value="stripe">Stripe</option><option value="square">Square</option><option value="paycas">PayCAS</option></select></label>
            <p className="text-[11px] leading-5 text-[var(--mikke-muted)]">ここでは方法だけ選びます。決済連携や公開は、詳細設定と確認が終わるまで行われません。</p>
          </>
        ) : null}
      </section>

      <div className="flex items-center justify-between gap-3">
        <button type="button" disabled={step === 1} onClick={() => setStep((current) => current - 1)} className="inline-flex items-center gap-1 rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-2.5 text-sm font-bold disabled:opacity-40"><ArrowLeft size={14} /> 戻る</button>
        <button type="button" disabled={!canContinue} onClick={() => step === 6 ? complete() : setStep((current) => current + 1)} className="inline-flex items-center gap-1 rounded-xl bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">
          {step === 6 ? "回答を詳細設定へ反映" : "次へ"} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
