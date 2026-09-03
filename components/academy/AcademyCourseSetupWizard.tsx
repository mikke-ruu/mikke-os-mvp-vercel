"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { DEFAULT_ACADEMY_COURSE_FEATURE_SETTINGS } from "@/lib/academy/course-feature-settings";
import type { CourseInput } from "@/lib/academy/courses";

type WizardAnswers = {
  code: string;
  name: string;
  formats: ("in_person" | "online")[];
  durationText: string;
  intake: "honbu" | "koushi" | "both";
  materialType: "none" | "digital" | "physical";
  stepLearning: boolean;
  price: string;
  paymentProvider: CourseInput["paymentProvider"];
  progression: "scheduled" | "arranged" | "subscription";
  certification: boolean;
};

const inputClass = "mt-1 min-w-0 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-base text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)] sm:text-sm";
const initialAnswers: WizardAnswers = {
  code: "", name: "", formats: [], durationText: "", intake: "honbu", materialType: "none",
  stepLearning: false, price: "", paymentProvider: "manual", progression: "scheduled", certification: false
};

function automaticCourseCode() {
  const now = new Date();
  const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("");
  const time = [String(now.getHours()).padStart(2, "0"), String(now.getMinutes()).padStart(2, "0")].join("");
  return `COURSE-${date}-${time}`;
}

function Choice({ selected, title, description, onClick }: { selected: boolean; title: string; description?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${selected ? "border-[#3f4eb5] bg-[#3f4eb5] text-white" : "border-[var(--mikke-line)] bg-white text-[var(--mikke-text-soft)] hover:border-[#3f4eb5]"}`}
    >
      <span className="flex items-center justify-between gap-3 font-bold">{title}{selected ? <Check size={17} aria-label="選択中" /> : null}</span>
      {description ? <span className={`mt-1 block text-xs leading-5 ${selected ? "text-white/90" : "text-[var(--mikke-muted)]"}`}>{description}</span> : null}
    </button>
  );
}

export function AcademyCourseSetupWizard({ onComplete }: { onComplete: (initial: Partial<CourseInput>) => void }) {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState(initialAnswers);

  function complete() {
    const physicalMaterials = answers.materialType === "physical";
    const hasDigitalMaterials = answers.materialType === "digital" || answers.stepLearning;
    const subscriptions = answers.progression === "subscription";
    const teacherOperates = answers.intake !== "honbu";
    onComplete({
      code: answers.code.trim() || automaticCourseCode(),
      name: answers.name.trim(),
      description: "",
      formats: answers.formats,
      durationText: answers.durationText.trim(),
      acceptAtHonbu: answers.intake !== "koushi",
      acceptAtKoushi: teacherOperates,
      materialContents: answers.materialType === "digital" ? "PDF・動画・外部URLなどのデジタル教材を使用する" : physicalMaterials ? "現物教材を発送する" : "教材の発送なし",
      requiresKit: physicalMaterials,
      price: Number(answers.price) || 0,
      paymentProvider: answers.paymentProvider,
      featureSettings: {
        ...DEFAULT_ACADEMY_COURSE_FEATURE_SETTINGS,
        stepLearning: answers.stepLearning,
        materialLicenses: hasDigitalMaterials || physicalMaterials,
        materialAssignments: answers.stepLearning,
        applications: true,
        classes: true,
        kits: physicalMaterials,
        certification: answers.certification,
        renewal: answers.certification,
        subscriptions,
        publicCoursePage: true,
        portal: {
          learning: hasDigitalMaterials,
          applications: teacherOperates,
          classes: teacherOperates,
          approvals: answers.stepLearning,
          kits: physicalMaterials,
          procurement: physicalMaterials,
          credentials: answers.certification,
          subscription: subscriptions
        }
      }
    });
  }

  const canContinue = step === 1 ? Boolean(answers.name.trim()) : step === 2 ? answers.formats.length > 0 : step === 5 ? answers.price !== "" && Number(answers.price) >= 0 : true;

  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-2xl border border-[var(--mikke-accent)]/35 bg-[var(--mikke-accent-soft)] p-4">
        <p className="text-xs font-bold text-[var(--mikke-accent-strong)]">講座づくり {step}/6</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[var(--mikke-accent)] transition-all" style={{ width: `${(step / 6) * 100}%` }} /></div>
        <p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]">質問に答えると、講座が出来上がります。下書きのため、まだ公開にはなりません。</p>
      </div>

      <section className="space-y-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 sm:min-h-80 sm:p-5">
        {step === 1 ? <>
          <h2 className="text-base font-bold">講座名を決めましょう</h2>
          <label className="block text-xs font-bold">講座名*<input className={inputClass} value={answers.name} onChange={(e) => setAnswers({ ...answers, name: e.target.value })} placeholder="スキルビジネス構築コース" /><span className="mt-1 block font-normal leading-5 text-[var(--mikke-muted)]">講座名を入力してください。後から変更できます。</span></label>
          <label className="block text-xs font-bold">管理用コード（任意）<input className={inputClass} value={answers.code} onChange={(e) => setAnswers({ ...answers, code: e.target.value })} placeholder="BASIC-01" /><span className="mt-1 block font-normal leading-5 text-[var(--mikke-muted)]">本部内で講座を区別する管理番号です。英数字とハイフンを推奨します。後から変更でき、空欄なら自動で作成します。</span></label>
        </> : null}

        {step === 2 ? <>
          <h2 className="text-base font-bold">講座の開催方法を選んでください</h2>
          <p className="text-xs leading-5 text-[var(--mikke-muted)]">当てはまるものを選んでください。両方選ぶこともできます。後から変更できます。</p>
          <div className="grid gap-2 sm:grid-cols-2">{(["in_person", "online"] as const).map((format) => <Choice key={format} selected={answers.formats.includes(format)} title={format === "in_person" ? "対面" : "オンライン"} onClick={() => setAnswers({ ...answers, formats: answers.formats.includes(format) ? answers.formats.filter((item) => item !== format) : [...answers.formats, format] })} />)}</div>
          <label className="block text-xs font-bold">所要時間（目安）<input className={inputClass} value={answers.durationText} onChange={(e) => setAnswers({ ...answers, durationText: e.target.value })} placeholder="約3時間 / 1回90分 / 全6回など" /></label>
        </> : null}

        {step === 3 ? <>
          <h2 className="text-base font-bold">講座申込はどなたが受付できるようにしますか？</h2>
          <div className="grid gap-2">{([
            ["honbu", "本部だけで受け付ける", "本部の管理画面で申込を確認・対応します。"],
            ["koushi", "担当講師だけで受け付ける", "担当講師のマイポータルで申込を確認・対応します。"],
            ["both", "本部と担当講師が受け付ける", "本部と担当講師の両方で申込を確認・対応できます。"]
          ] as const).map(([value, title, description]) => <Choice key={value} selected={answers.intake === value} title={title} description={description} onClick={() => setAnswers({ ...answers, intake: value })} />)}</div>
        </> : null}

        {step === 4 ? <>
          <h2 className="text-base font-bold">講座では教材（キット）を発送しますか？</h2>
          <div className="grid gap-2">{([
            ["none", "発送しない・教材なし", "教材の配布や発送管理を使いません。"],
            ["digital", "発送しない・デジタル教材を使用する", "PDF、動画、外部URLなどをマイポータルで共有します。"],
            ["physical", "現物教材を発送する", "配送先を受け取り、教材の準備・発送状況を管理します。"]
          ] as const).map(([value, title, description]) => <Choice key={value} selected={answers.materialType === value} title={title} description={description} onClick={() => setAnswers({ ...answers, materialType: value })} />)}</div>
          <div className="rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4">
            <p className="text-sm font-bold">オンラインのステップ教材（準備中）</p>
            <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">限定pilotではまだ利用できません。PDF、動画の外部URL、ダウンロード資料は「復習ページ」で受講者へ共有できます。</p>
          </div>
        </> : null}

        {step === 5 ? <>
          <h2 className="text-base font-bold">受講料と決済方法を決めましょう</h2>
          <p className="text-xs leading-5 text-[var(--mikke-muted)]">受講者が支払う税込金額と、受講者の決済方法を決めます。</p>
          <label className="block text-xs font-bold">受講料（税込・円）*<input type="number" min="0" className={inputClass} value={answers.price} onChange={(e) => setAnswers({ ...answers, price: e.target.value })} /></label>
          <label className="block text-xs font-bold">決済方法<select className={inputClass} value={answers.paymentProvider} onChange={(e) => setAnswers({ ...answers, paymentProvider: e.target.value as CourseInput["paymentProvider"] })}><option value="manual">銀行振込・現金など</option><option value="stripe">Stripe（外部決済リンク・要事前設定）</option><option value="square">Square（外部決済リンク・要事前設定）</option><option value="paycas">PayCAS（本部で確認）</option></select></label>
          <p className="text-[11px] leading-5 text-[var(--mikke-muted)]">受講者の決済方法です。Academy利用料の請求とは別です。限定pilotでは自動連携せず、設定済みの外部決済リンクまたは手動案内を使います。</p>
        </> : null}

        {step === 6 ? <>
          <h2 className="text-base font-bold">どのように講座を進めますか？</h2>
          <p className="text-xs leading-5 text-[var(--mikke-muted)]">基本の募集・開催方法を1つ選んでください。後から変更できます。</p>
          <div className="grid gap-2">{([
            ["scheduled", "開催日を決めて募集する", "日時・定員・担当講師を設定し、受講者を募集します。"],
            ["arranged", "申込後に日程を相談する", "申込を受けた後、本部または担当講師が受講者と開催日を決めます。"],
            ["subscription", "月額で継続して受講してもらう", "会費や継続受講の契約状態を管理します。"]
          ] as const).map(([value, title, description]) => <Choice key={value} selected={answers.progression === value} title={title} description={description} onClick={() => setAnswers({ ...answers, progression: value })} />)}</div>
          <div className="border-t border-[var(--mikke-line)] pt-4"><Choice selected={answers.certification} title="修了者を認定講師として管理する" description="認定日・講師番号・認定状態を台帳に記録します。認定証の自動発送ではありません。" onClick={() => setAnswers({ ...answers, certification: !answers.certification })} /></div>
        </> : null}
      </section>

      <div className="flex items-center justify-between gap-3">
        <button type="button" disabled={step === 1} onClick={() => setStep((current) => current - 1)} className="inline-flex items-center gap-1 rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-2.5 text-sm font-bold disabled:opacity-40"><ArrowLeft size={14} /> 戻る</button>
        <button type="button" disabled={!canContinue} onClick={() => step === 6 ? complete() : setStep((current) => current + 1)} className="inline-flex items-center gap-1 rounded-xl bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{step === 6 ? "講座の基本設定を完成" : "次へ"} <ArrowRight size={14} /></button>
      </div>
    </div>
  );
}
