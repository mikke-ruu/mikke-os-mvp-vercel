"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AcademyHelp } from "@/components/academy/AcademyHelp";
import { AcademyImageUploader } from "@/components/academy/AcademyImageUploader";
import type {
  AcademyCourseFeatureSettings,
  AcademyCoursePortalFeatureSettings,
  AcademyFaqItem,
  AcademyFormField
} from "@/types/database";
import type { CourseInput } from "@/lib/academy/courses";
import { DEFAULT_ACADEMY_COURSE_FEATURE_SETTINGS } from "@/lib/academy/course-feature-settings";
import { getAcademyCourseSaveErrorMessage } from "@/lib/academy/course-save-errors";

const FIELD_TYPES: AcademyFormField["type"][] = ["text", "textarea", "email", "tel", "select", "checkbox"];

const COURSE_FEATURES: Array<{ key: keyof Omit<AcademyCourseFeatureSettings, "portal">; label: string; description: string; location: string }> = [
  { key: "stepLearning", label: "オンラインのステップ教材（準備中）", description: "限定pilotでは利用できません。受講者への共有は復習ページを使います。", location: "準備中" },
  { key: "materialLicenses", label: "認定講師へ資料を共有", description: "講座の進め方、PDF、動画、外部URLなどを講師のマイポータルに表示します。", location: "講師用資料ページ・講師用ファイル" },
  { key: "materialAssignments", label: "受講者に復習教材を割り当てる", description: "誰がどの復習教材を見られるかを管理します。", location: "復習ページ" },
  { key: "applications", label: "講座申込を受け付ける", description: "公開講座ページに紹介と申込フォームを表示します。", location: "公開講座ページ" },
  { key: "classes", label: "開催日程・参加者を管理", description: "講座を実際に行う日時、定員、担当講師、参加者をまとめます。", location: "開催日程・担当講師" },
  { key: "kits", label: "現物教材を発送", description: "教材の注文、配送先、発送状況を管理します。", location: "教材・キット" },
  { key: "certification", label: "修了者を認定講師として管理", description: "本人の承諾後、認定日・講師番号・認定状態を記録します。", location: "講師管理" },
  { key: "renewal", label: "認定の更新期限を管理", description: "更新日と更新状況を記録します。", location: "講師管理" },
  { key: "subscriptions", label: "月額で継続受講", description: "会費や継続受講の契約状態を管理します。", location: "契約管理" },
  { key: "publicCoursePage", label: "公開講座ページ", description: "1つの講座の内容・料金・開催方法を紹介し、必要に応じて申込を受け付けます。", location: "公開講座ページ" }
];

const PORTAL_FEATURES: Array<{ key: keyof AcademyCoursePortalFeatureSettings; label: string; description: string }> = [
  { key: "learning", label: "復習ページ", description: "受講中・修了後の復習内容をマイポータルで見る" },
  { key: "applications", label: "自分経由の申込", description: "営業権限がある講師が申込を確認する" },
  { key: "classes", label: "担当する開催日", description: "講師が自分の開催予定と参加者を確認する" },
  { key: "approvals", label: "課題の提出・確認", description: "受講者の提出物と講師の確認を行う" },
  { key: "kits", label: "教材・キット", description: "発送状況や利用できる教材を確認する" },
  { key: "procurement", label: "キット・資材発注", description: "認定講師が講座用の教材を発注する" },
  { key: "credentials", label: "取得した認定", description: "認定講師が認定状況と営業できる講座を確認する" },
  { key: "subscription", label: "継続受講・契約状況", description: "会費や継続受講の状態を確認する" }
];

const LEARNER_ACCESS_MODES: Array<{
  value: CourseInput["learnerAccessMode"];
  label: string;
  description: string;
}> = [
  { value: "unlimited", label: "期限なし", description: "受講後も引き続き見られます" },
  { value: "days_after_payment", label: "入金日から", description: "入金確認を起点にします" },
  { value: "days_after_enrollment", label: "受講開始日から", description: "受講登録を起点にします" },
  { value: "days_after_completion", label: "修了日から", description: "講座の修了を起点にします" },
  { value: "fixed_end", label: "終了日を指定", description: "全受講者が同じ日時まで見られます" }
];

const inputClass =
  "min-w-0 w-full rounded-sm border border-[var(--mikke-line)] bg-white px-3 py-2 text-base text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)] sm:text-sm";
const labelClass = "block text-sm font-bold text-[var(--mikke-text-soft)]";

function emptyInput(): CourseInput {
  return {
    code: "",
    name: "",
    subtitle: "",
    mainImageUrl: "",
    description: "",
    price: 0,
    durationText: "",
    formats: [],
    certificationConditions: "",
    canDoAfter: "",
    kitContents: "",
    materialContents: "",
    faq: [],
    applicationFormFields: [],
    acceptAtHonbu: true,
    acceptAtKoushi: true,
    paymentUrl: "",
    paymentProvider: "manual",
    kitPrice: 0,
    kitPaymentUrl: "",
    requiresKit: false,
    learnerAccessMode: "unlimited",
    learnerAccessDays: null,
    learnerAccessFixedEndAt: "",
    featureSettings: {
      ...DEFAULT_ACADEMY_COURSE_FEATURE_SETTINGS,
      stepLearning: false,
      materialLicenses: false,
      materialAssignments: false,
      kits: false,
      certification: false,
      renewal: false,
      subscriptions: false,
      portal: {
        learning: false,
        applications: false,
        classes: false,
        approvals: false,
        kits: false,
        procurement: false,
        credentials: false,
        subscription: false
      }
    }
  };
}

export function CourseForm({
  initial,
  submitLabel,
  onSubmit
}: {
  initial?: Partial<CourseInput>;
  submitLabel: string;
  onSubmit: (input: CourseInput) => Promise<void>;
}) {
  const [form, setForm] = useState<CourseInput>({ ...emptyInput(), ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(false);
  const [step, setStep] = useState(0);
  const guideRef = useRef<HTMLDivElement>(null);
  const steps = [
    ["講座を紹介する", "誰に、何を教える講座ですか？写真や紹介文は後からでも保存できます。"],
    ["開催方法を決める", "対面・オンライン、所要時間を案内します。具体的な日付や担当講師は、保存後に「開催日程」で登録します。"],
    ["料金・申込を整える", "受講料と申込の受け付け方を確認します。決済会社を選ぶだけでは自動集金されません。"],
    ["教材・講師を整える", "教材を渡す、講師に教えてもらう、認定する場合の設定です。使わない機能は選ばず次へ進めます。"],
    ["内容を確認する", "入力した内容を確認して保存します。この確認だけで公開や課金は行いません。"]
  ];
  function goToStep(next: number) {
    setStep(next);
    requestAnimationFrame(() => guideRef.current?.scrollIntoView({ block: "start" }));
  }

  function showError(message: string) {
    setError(message);
    requestAnimationFrame(() => {
      errorRef.current?.focus({ preventScroll: true });
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function set<K extends keyof CourseInput>(key: K, value: CourseInput[K]) {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleFormat(value: "in_person" | "online") {
    setSaved(false);
    setForm((prev) => ({
      ...prev,
      formats: prev.formats.includes(value)
        ? prev.formats.filter((f) => f !== value)
        : [...prev.formats, value]
    }));
  }

  function toggleCourseFeature(key: keyof Omit<AcademyCourseFeatureSettings, "portal">) {
    setSaved(false);
    setForm((prev) => {
      const enabled = !prev.featureSettings[key];
      const next = {
        ...prev.featureSettings,
        [key]: enabled,
        portal: { ...prev.featureSettings.portal }
      };
      if (key === "stepLearning" && !enabled) next.portal.learning = false;
      if (key === "applications" && !enabled) next.portal.applications = false;
      if (key === "classes" && !enabled) next.portal.classes = false;
      if (key === "kits" && !enabled) {
        next.portal.kits = false;
        next.portal.procurement = false;
      }
      if (key === "certification" && !enabled) {
        next.renewal = false;
        next.portal.credentials = false;
      }
      if (key === "subscriptions" && !enabled) next.portal.subscription = false;
      return { ...prev, requiresKit: key === "kits" ? enabled : prev.requiresKit, featureSettings: next };
    });
  }

  function togglePortalFeature(key: keyof AcademyCoursePortalFeatureSettings) {
    setSaved(false);
    setForm((prev) => ({
      ...prev,
      featureSettings: {
        ...prev.featureSettings,
        portal: { ...prev.featureSettings.portal, [key]: !prev.featureSettings.portal[key] }
      }
    }));
  }

  function setCoursePageMode(mode: "application" | "introduction" | "none") {
    setSaved(false);
    setForm((prev) => ({
      ...prev,
      featureSettings: {
        ...prev.featureSettings,
        publicCoursePage: mode !== "none",
        applications: mode === "application",
        portal: {
          ...prev.featureSettings.portal,
          applications: mode === "application" && prev.acceptAtKoushi
        }
      }
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setStep(0);
      showError("講座名は必須です。");
      return;
    }
    if (form.learnerAccessMode.startsWith("days_after_") && (!form.learnerAccessDays || form.learnerAccessDays < 1 || form.learnerAccessDays > 3650)) {
      setStep(3);
      showError("教材を見られる日数は、1日から3650日の間で入力してください。");
      return;
    }
    if (form.learnerAccessMode === "fixed_end" && (!form.learnerAccessFixedEndAt || Number.isNaN(new Date(form.learnerAccessFixedEndAt).getTime()))) {
      setStep(3);
      showError("教材の閲覧終了日時を入力してください。");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        code: form.code.trim() || `COURSE-${Date.now().toString().slice(-8)}`
      });
      setSaved(true);
      setSaving(false);
    } catch (err) {
      showError(getAcademyCourseSaveErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} onInvalidCapture={(event) => {
      const target = event.target as HTMLInputElement;
      const panel = target.closest<HTMLElement>("[data-course-step]");
      if (panel && Number(panel.dataset.courseStep) !== step) {
        event.preventDefault();
        setStep(Number(panel.dataset.courseStep));
        requestAnimationFrame(() => { target.focus(); target.reportValidity(); });
      }
    }} className="min-w-0 space-y-4">
      <div ref={guideRef} className="scroll-mt-20 border-b border-[var(--mikke-line)] bg-white pb-4">
        <p className="text-sm text-[var(--mikke-muted)]">講座づくりの道順 · {step + 1} / {steps.length}</p>
        <nav aria-label="講座づくりの手順" className="my-3 grid grid-cols-2 gap-1 sm:grid-cols-5">
          {steps.map(([title], index) => <button key={title} type="button" onClick={() => goToStep(index)} aria-current={step === index ? "step" : undefined} className={`min-h-12 border-b-2 px-2 py-2 text-left text-sm ${step === index ? "border-[var(--mikke-primary)] font-bold text-[var(--mikke-primary)]" : "border-transparent text-[var(--mikke-muted)]"}`}>{index + 1}. {title}</button>)}
        </nav>
        <h2 className="text-xl font-bold">{steps[step][0]}</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--mikke-muted)]">{steps[step][1]}</p>
        <p className="mt-2 text-xs text-[var(--mikke-muted)]">手順の切替では入力を保持します。再読み込みや別ページへ移る前に保存してください。</p>
      </div>
      {error ? (
        <div ref={errorRef} tabIndex={-1} role="alert" aria-live="assertive" className="rounded-sm border border-[var(--mikke-danger)] bg-red-50 px-4 py-3 outline-none">
          <p className="text-sm font-bold text-[var(--mikke-danger)]">講座を保存できませんでした</p>
          <p className="mt-1 text-sm leading-6 text-[var(--mikke-text)]">原因: {error}</p>
        </div>
      ) : null}
      <section hidden={step !== 0} data-course-step={0} className="space-y-4 rounded-sm border border-[var(--mikke-line)] bg-white p-4 sm:p-6">
        <h3 className="text-lg font-bold">講座の紹介</h3>
        <p className="text-sm leading-6 text-[var(--mikke-muted)]">どんな人に、何を教える講座ですか？短い説明から始めましょう。</p>
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-2">

          <div className="min-w-0 sm:col-span-3">
            <label htmlFor="academy-course-name" className={labelClass}>講座名*</label>
            <input id="academy-course-name" className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="コンテナアロマキャンドル認定講座" />
            <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">講座名を入力してください。後から変更できます。</p>
          </div>
        </div>
        <div>
          <label htmlFor="academy-course-subtitle" className={labelClass}>ひとことで紹介（任意）</label>
          <input id="academy-course-subtitle" className={inputClass} value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>講座の写真（任意）</label>
          <AcademyImageUploader currentUrl={form.mainImageUrl || undefined} onUploaded={(url) => set("mainImageUrl", url)} />
        </div>
        <div>
          <label htmlFor="academy-course-description" className={labelClass}>講座説明</label>
          <textarea id="academy-course-description" className={`${inputClass} min-h-32`} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="どんな人におすすめですか？この講座で体験できること・身につくことを書いてみましょう。" />
        </div>
      </section>

      <section hidden={step !== 2} data-course-step={2} className="space-y-4 rounded-sm border border-[var(--mikke-line)] bg-white p-4 sm:p-6">
        <h3 className="text-base font-bold">受講料・支払い方法 <span className="ml-2 text-sm font-normal text-[var(--mikke-muted)]">{form.price.toLocaleString()}円</span></h3>
        <div>
          <label className={labelClass}>受講料（税込・円）</label>
          <AcademyHelp title="受講料（税込・円）">受講者がこの講座に払う金額です。Academyの利用料金とは別です。無料なら0円。ここで金額を変更して保存しても、決済は実行されません。</AcademyHelp>
          <input type="number" min={0} className={inputClass} value={form.price} onChange={(e) => set("price", Number(e.target.value) || 0)} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className={labelClass}>受講者の決済方法</label>
          <AcademyHelp title="受講者の決済方法">振込や現金で受け取る場合は「手動」を選びます。Stripe・Squareは、あなたが用意した外部決済リンクを案内する設定です。選ぶだけで自動集金は始まりません。</AcademyHelp>
            <select
              className={inputClass}
              value={form.paymentProvider}
              onChange={(e) => set("paymentProvider", e.target.value as CourseInput["paymentProvider"])}
            >
              <option value="manual">手動（振込・現金など）</option>
              <option value="stripe">Stripe</option>
              <option value="square">Square</option>
              <option value="paycas">PayCAS（端末確認）</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>受講料の決済URL（外部）</label>
          <AcademyHelp title="受講料の決済URL（外部）">受講者に案内する、設定済みの決済ページのURLです。振込・現金で受け付ける場合は空欄で構いません。</AcademyHelp>
            <input className={inputClass} value={form.paymentUrl} onChange={(e) => set("paymentUrl", e.target.value)} placeholder="https://…" />
          </div>
        </div>
        <p className="text-sm leading-6 text-[var(--mikke-muted)]">ここは、受講者が講座を申し込むときの料金と決済先です。</p>
        <p className="text-sm leading-6 text-[var(--mikke-muted)]">Stripe・Squareは設定済みの外部決済リンクを使います。選択だけでは自動連携されません。</p>
      </section>
      <section hidden={step !== 1} data-course-step={1} className="space-y-4 rounded-sm border border-[var(--mikke-line)] bg-white p-4 sm:p-6">
        <h3 className="text-base font-bold">開催方法・受講後にできること</h3>
        <div>
          <label className={labelClass}>所要時間（目安）</label>
          <AcademyHelp title="所要時間（目安）">1回の講座にかかる時間や回数を書きます。例：90分、全3回・各2時間。具体的な開催日は、保存後に「開催日程・担当講師」で登録します。</AcademyHelp>
          <input className={inputClass} value={form.durationText} onChange={(e) => set("durationText", e.target.value)} placeholder="約3時間" />
        </div>
        <div>
          <label className={labelClass}>受講形式</label>
          <AcademyHelp title="受講形式">対面とオンラインの両方を選べます。開催場所や日時そのものではなく、どのように教える講座かを案内する項目です。</AcademyHelp>
          <div className="mt-1 flex gap-2">
            {(["in_person", "online"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => toggleFormat(f)}
                className={`rounded-sm border px-3 py-1 text-xs font-bold ${
                  form.formats.includes(f)
                    ? "border-[var(--mikke-accent)] bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]"
                    : "border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"
                }`}
              >
                {f === "in_person" ? "対面" : "オンライン"}
              </button>
            ))}
          </div>
        </div>
        {form.featureSettings.certification ? <div>
          <label className={labelClass}>認定の条件</label>
          <AcademyHelp title="認定の条件">修了者を認定講師として登録する場合に、必要な条件を説明します。認定制度を使わない講座には不要です。記入だけで誰かが自動認定されることはありません。</AcademyHelp>
          <textarea className={`${inputClass} min-h-16`} value={form.certificationConditions} onChange={(e) => set("certificationConditions", e.target.value)} />
          <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">例：講座修了、本人の講師活動への意思、規約への同意、mikke Communityまたは外部コミュニティへの参加、本部の承認。認定証の自動発送を設定する項目ではありません。</p>
        </div> : null}
        <div>
          <label className={labelClass}>受講後にできること</label>
          <textarea className={`${inputClass} min-h-16`} value={form.canDoAfter} onChange={(e) => set("canDoAfter", e.target.value)} />
        </div>
      </section>
      <section hidden={step !== 3} data-course-step={3} className="space-y-4 rounded-sm border border-[var(--mikke-line)] bg-white p-4 sm:p-6">
        <h3 className="text-base font-bold">教材・資料を使う場合</h3>
        <div>
          <p className="text-sm font-bold text-[var(--mikke-accent)]">認定講師が仕入れるもの</p>
          <p className="mt-1 text-sm leading-6 text-[var(--mikke-muted)]">受講料とは別に、認定講師が自分で講座を開催するための仕入れを設定します。</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--mikke-text)]">
          <input
            type="checkbox"
            checked={form.featureSettings.kits}
            onChange={() => toggleCourseFeature("kits")}
          />
          この講座では、認定講師が開催用教材を仕入れる
        </label>
        {form.featureSettings.kits ? (
          <>
            <div>
              <label className={labelClass}>仕入れる教材の内容</label>
              <textarea className={`${inputClass} min-h-16`} value={form.kitContents} onChange={(e) => set("kitContents", e.target.value)} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className={labelClass}>講師の講座仕入代（税込）</label>
          <AcademyHelp title="講師の講座仕入代（税込）">認定講師が、自分で講座を開催するための教材を仕入れる金額です。受講者の受講料とは別です。講師への教材販売をしない場合は設定不要です。</AcademyHelp>
                <input type="number" min={0} className={inputClass} value={form.kitPrice} onChange={(e) => set("kitPrice", Number(e.target.value) || 0)} />
              </div>
              <div>
                <label className={labelClass}>講座仕入代の決済URL</label>
                <input className={inputClass} value={form.kitPaymentUrl} onChange={(e) => set("kitPaymentUrl", e.target.value)} placeholder="https://…" />
              </div>
            </div>
          </>
        ) : null}
        <div className="border-t border-[var(--mikke-line-soft)] pt-3">
          <p className="text-xs font-bold text-[var(--mikke-accent)]">受講者へ渡す教材</p>
          <p className="mt-1 text-sm leading-6 text-[var(--mikke-muted)]">公開講座ページで、受講者にどんな教材があるか案内します。</p>
        </div>
        <div>
          <label className={labelClass}>受講者への教材案内</label>
          <AcademyHelp title="受講者への教材案内">受講者に渡す教材を紹介する文章です。例：当日テキスト配布、復習用PDFあり。ファイルを登録する場所ではありません。</AcademyHelp>
          <textarea className={`${inputClass} min-h-16`} value={form.materialContents} onChange={(e) => set("materialContents", e.target.value)} />
          <p className="mt-1 text-sm leading-6 text-[var(--mikke-muted)]">例：現物テキストを発送、PDFをダウンロード、動画URLを案内。実際の復習内容と講師用資料は、それぞれ専用ページで管理します。</p>
        </div>
        <div className="border-t border-[var(--mikke-line-soft)] pt-4">
          <p className="text-sm font-bold text-[var(--mikke-text)]">教材を見られる期間</p>
          <p className="mt-1 text-sm leading-6 text-[var(--mikke-muted)]">
            ステップ教材、復習ページ、受講者向け資料、動画にまとめて適用します。認定講師用の資料は、講師登録・資格の状態で別に管理します。
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {LEARNER_ACCESS_MODES.map((mode) => {
            const selected = form.learnerAccessMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  set("learnerAccessMode", mode.value);
                  if (mode.value === "unlimited") {
                    set("learnerAccessDays", null);
                    set("learnerAccessFixedEndAt", "");
                  } else if (mode.value === "fixed_end") {
                    set("learnerAccessDays", null);
                  } else {
                    set("learnerAccessFixedEndAt", "");
                    if (!form.learnerAccessDays) set("learnerAccessDays", 365);
                  }
                }}
                className={`rounded-sm border p-3 text-left ${selected ? "border-[#3f4eb5] bg-[#3f4eb5] text-white" : "border-[var(--mikke-line)] bg-white text-[var(--mikke-text)]"}`}
              >
                <span className="block text-sm font-bold">{mode.label}</span>
                <span className={`mt-1 block text-[11px] leading-5 ${selected ? "text-white/90" : "text-[var(--mikke-muted)]"}`}>{mode.description}</span>
              </button>
            );
          })}
        </div>
        {form.learnerAccessMode.startsWith("days_after_") ? (
          <div className="max-w-xs">
            <label className={labelClass}>見られる日数</label>
          <AcademyHelp title="見られる日数">受講者がオンライン教材を見られる期間です。開始の基準日は上の選択で決まります。既存の受講者の期限が、この変更だけで一斉に変更されるものではありません。</AcademyHelp>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={3650}
                className={inputClass}
                value={form.learnerAccessDays ?? ""}
                onChange={(e) => set("learnerAccessDays", e.target.value ? Number(e.target.value) : null)}
              />
              <span className="shrink-0 text-sm font-bold text-[var(--mikke-text)]">日間</span>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">例：1年間なら365日。後から講座設定を変更しても、すでに受講を始めた人の期限は変わりません。</p>
          </div>
        ) : null}
        {form.learnerAccessMode === "fixed_end" ? (
          <div className="max-w-sm">
            <label className={labelClass}>閲覧終了日時</label>
            <input
              type="datetime-local"
              className={inputClass}
              value={form.learnerAccessFixedEndAt}
              onChange={(e) => set("learnerAccessFixedEndAt", e.target.value)}
            />
            <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">この日時を過ぎると、受講者には教材本文を表示しません。修了・認定の履歴は残ります。</p>
          </div>
        ) : null}
      </section>

      <section hidden={step !== 2} data-course-step={2} className="space-y-3 rounded-sm border border-[var(--mikke-line)] bg-white p-4 sm:p-6">
        <h3 className="text-base font-bold">紹介ページと申込の受け付け方</h3>
        <div>
          <p className="text-sm font-bold text-[var(--mikke-text)]">公開講座ページ</p>
          <p className="mt-1 text-sm leading-6 text-[var(--mikke-muted)]">1つの講座の内容・料金・開催方法を紹介し、必要に応じて申込も受け付けるページです。本部全体のホームページとは別です。</p>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {([
            ["application", "講座を紹介して、申込も受け付ける", "紹介と申込フォームを表示"],
            ["introduction", "講座の紹介だけ掲載する", "申込は電話・メールなどで受付"],
            ["none", "ページを作らない", "Academy上に講座の紹介ページを出さない"]
          ] as const).map(([mode, title, description]) => {
            const selected = mode === "application"
              ? form.featureSettings.publicCoursePage && form.featureSettings.applications
              : mode === "introduction"
                ? form.featureSettings.publicCoursePage && !form.featureSettings.applications
                : !form.featureSettings.publicCoursePage;
            return (
              <button key={mode} type="button" aria-pressed={selected} onClick={() => setCoursePageMode(mode)} className={`rounded-sm border p-3 text-left ${selected ? "border-[#3f4eb5] bg-[#3f4eb5] text-white" : "border-[var(--mikke-line)] bg-white text-[var(--mikke-text)]"}`}>
                <span className="block text-sm font-bold">{title}</span>
                <span className={`mt-1 block text-[11px] leading-5 ${selected ? "text-white/90" : "text-[var(--mikke-muted)]"}`}>{description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section hidden={step !== 3} data-course-step={3} className="space-y-4 rounded-sm border border-[var(--mikke-line)] bg-white p-4 sm:p-6">
        <h3 className="text-base font-bold">認定・発送など、使う機能を選ぶ</h3>
          <section className="min-w-0 sm:col-span-1"><h3 className="cursor-pointer py-2 text-sm text-[var(--mikke-muted)]">管理用の番号</h3>
            <label className={labelClass}>管理用コード（任意）</label>
          <AcademyHelp title="管理用コード（任意）">運営側が講座を区別するための番号です。自動で入っている値のままで構いません。受講者向けの講座名とは別です。</AcademyHelp>
            <input className={inputClass} value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="CACM" />
            <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">本部内で講座を区別する番号です。英数字とハイフンを推奨します。空欄なら自動で作成します。</p>
          </section>
        <div>
          <p className="text-sm font-bold text-[var(--mikke-accent)]">この講座で使う機能</p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">この講座で使える機能と、どこで設定するかを表示しています。</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {COURSE_FEATURES.filter((feature) => form.featureSettings[feature.key]).map((feature) => (
            <div key={feature.key} className="rounded-sm border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
              <p className="text-sm font-bold text-[var(--mikke-text)]">{feature.label}</p>
              <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">{feature.description}</p>
              <p className="mt-2 text-[10px] font-bold text-[var(--mikke-accent-strong)]">設定する場所：{feature.location}</p>
            </div>
          ))}
        </div>

        <section className="border-t border-[var(--mikke-line)] pt-4">
          <h3 className="cursor-pointer text-sm font-bold text-[var(--mikke-accent-strong)]">使う機能を変更する</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">必要になった機能だけ選んでください。既存の設定は、変更して保存するまで保たれます。</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {COURSE_FEATURES.map((feature) => (
              <label key={feature.key} className="flex items-start justify-between gap-3 rounded-sm border border-[var(--mikke-line)] bg-white p-3 text-sm text-[var(--mikke-text)]">
                <span><span className="block font-bold">{feature.label}</span><span className="mt-1 block text-[11px] leading-5 text-[var(--mikke-muted)]">{feature.description}</span></span>
                <input className="mt-1" type="checkbox" disabled={feature.key === "stepLearning"} checked={feature.key === "stepLearning" ? false : form.featureSettings[feature.key]} onChange={() => toggleCourseFeature(feature.key)} />
              </label>
            ))}
          </div>

          <div className="mt-4 border-t border-[var(--mikke-line)] pt-4">
            <p className="text-xs font-bold text-[var(--mikke-accent)]">マイポータルに追加する機能</p>
            <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">受講者は教材や復習を確認し、認定講師になった人には申込・開催・発注などの機能を追加します。</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PORTAL_FEATURES.map((feature) => (
                <label key={feature.key} className="flex items-start justify-between gap-3 rounded-sm border border-[var(--mikke-line)] p-3 text-sm text-[var(--mikke-text)]">
                  <span><span className="block font-bold">{feature.label}</span><span className="mt-1 block text-[11px] leading-5 text-[var(--mikke-muted)]">{feature.description}</span></span>
                  <input className="mt-1" type="checkbox" checked={form.featureSettings.portal[feature.key]} onChange={() => togglePortalFeature(feature.key)} />
                </label>
              ))}
            </div>
          </div>
        </section>
      </section>

      <section hidden={step !== 2} data-course-step={2} className="rounded-sm border border-[var(--mikke-line)] bg-white p-4 sm:p-6"><h3 className="text-base font-bold">よくある質問・申込時の質問を追加</h3><div className="mt-4 space-y-4"><FaqEditor value={form.faq} onChange={(v) => set("faq", v)} /><FormFieldEditor value={form.applicationFormFields} onChange={(v) => set("applicationFormFields", v)} /></div></section>

      <section hidden={step !== 2} data-course-step={2} className="space-y-3 rounded-sm border border-[var(--mikke-line)] bg-white p-4 sm:p-6">
        <h3 className="text-base font-bold">申込に対応する人</h3>
        <AcademyHelp title="本部受付・講師受付">あなたの教室が直接申込に対応する場合は本部受付を使います。登録講師が自分のページで申込を受ける場合は講師受付も使います。一人で受け付けるなら、本部受付だけで構いません。</AcademyHelp>
        <label className="flex items-center gap-2 text-sm text-[var(--mikke-text)]">
          <input type="checkbox" checked={form.acceptAtHonbu} onChange={(e) => set("acceptAtHonbu", e.target.checked)} />
          本部受付を有効にする
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--mikke-text)]">
          <input type="checkbox" checked={form.acceptAtKoushi} onChange={(e) => set("acceptAtKoushi", e.target.checked)} />
          講師受付を有効にする
        </label>
      </section>

      {step === 4 ? <section className="space-y-4 border-y border-[var(--mikke-line)] py-5">
        <p className="text-sm text-[var(--mikke-muted)]">入力内容の確認（公開ページそのもののプレビューではありません）</p>
        <h3 className="break-words text-xl font-bold">{form.name || "講座名が未入力です"}</h3>
        <p className="break-words text-sm">{form.subtitle || "ひとこと紹介：未入力（任意）"}</p>
        <p className="whitespace-pre-wrap break-words text-sm leading-7">{form.description || "講座説明：まだ入力していません"}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
          <dt>受講料</dt><dd>{form.price.toLocaleString()}円</dd>
          <dt>開催方法</dt><dd>{form.formats.map(value => value === "online" ? "オンライン" : "対面").join("・") || "未定"}</dd>
          <dt>所要時間</dt><dd>{form.durationText || "未定"}</dd>
          <dt>申込</dt><dd>{form.featureSettings.applications ? "受け付ける設定" : "受け付けない設定"}</dd>
          <dt>教材の案内</dt><dd className="min-w-0 break-words">{form.materialContents || "なし・未入力"}</dd>
        </dl>
        <p className="text-sm leading-7">保存後は「紹介ページを整える」で見せ方を整え、「公開状態」で公開するかを選びます。日程の登録はホームの「開催日程・担当講師」から進めます。</p>
      </section> : null}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--mikke-line)] pt-4">
        <button type="button" disabled={step === 0} onClick={() => goToStep(step - 1)} className="min-h-11 px-3 text-sm disabled:opacity-30">← 前へ</button>
        {step < steps.length - 1 ? <button type="button" onClick={() => goToStep(step + 1)} className="min-h-11 border border-[var(--mikke-primary)] px-4 text-sm font-bold text-[var(--mikke-primary)]">次へ：{steps[step + 1][0]} →</button> : <span className="text-sm">確認できたら、下のボタンで保存</span>}
      </div>
      {step === 2 ? <button type="button" className="min-h-11 text-sm text-[var(--mikke-primary)]" onClick={() => goToStep(4)}>教材・講師の追加設定は変更せず、内容確認へ →</button> : null}
      {error ? <p className="text-sm font-bold text-[var(--mikke-danger)]">保存できなかった原因は、この画面の上部にも表示しています。</p> : null}

      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 rounded-sm border border-[var(--mikke-line)] bg-white p-3 shadow-sm min-[900px]:bottom-4">
      <p role="status" className="mb-2 text-center text-sm text-[var(--mikke-muted)]">{saved ? "変更を保存しました" : "編集した内容は、保存すると反映されます"}</p>
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-sm bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
      >
        {saving ? "保存中…" : submitLabel}
      </button>
      </div>
    </form>
  );
}

function FaqEditor({ value, onChange }: { value: AcademyFaqItem[]; onChange: (v: AcademyFaqItem[]) => void }) {
  return (
    <section className="space-y-2 rounded-sm border border-[var(--mikke-line)] bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[var(--mikke-accent)]">よくある質問</p>
        <button type="button" onClick={() => onChange([...value, { q: "", a: "" }])} className="flex items-center gap-1 text-xs font-bold text-[var(--mikke-accent-strong)]">
          <Plus size={14} /> 追加
        </button>
      </div>
      {value.length === 0 ? <p className="text-xs text-[var(--mikke-muted)]">まだありません。</p> : null}
      {value.map((item, i) => (
        <div key={i} className="space-y-1 rounded-sm border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-2">
          <div className="flex items-center gap-2">
            <input
              className={inputClass}
              placeholder="質問"
              value={item.q}
              onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, q: e.target.value } : v)))}
            />
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-[var(--mikke-danger)]">
              <Trash2 size={16} />
            </button>
          </div>
          <textarea
            className={`${inputClass} min-h-14`}
            placeholder="回答"
            value={item.a}
            onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, a: e.target.value } : v)))}
          />
        </div>
      ))}
    </section>
  );
}

function FormFieldEditor({ value, onChange }: { value: AcademyFormField[]; onChange: (v: AcademyFormField[]) => void }) {
  function add() {
    onChange([...value, { key: `field_${value.length + 1}`, label: "", type: "text", required: false }]);
  }
  return (
    <section className="space-y-2 rounded-sm border border-[var(--mikke-line)] bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-[var(--mikke-accent)]">申込フォーム項目</p>
        <button type="button" onClick={add} className="flex items-center gap-1 text-xs font-bold text-[var(--mikke-accent-strong)]">
          <Plus size={14} /> 追加
        </button>
      </div>
      <p className="text-[11px] text-[var(--mikke-muted)]">氏名・連絡先は既定で収集します。ここは講座固有の質問だけ追加します。</p>
      {value.map((field, i) => (
        <div key={i} className="space-y-1 rounded-sm border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-2">
          <div className="flex items-center gap-2">
            <input
              className={inputClass}
              placeholder="項目名（例: アレルギーの有無）"
              value={field.label}
              onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, label: e.target.value } : v)))}
            />
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-[var(--mikke-danger)]">
              <Trash2 size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select
              className={inputClass}
              value={field.type}
              onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, type: e.target.value as AcademyFormField["type"] } : v)))}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {{ text: "短い回答", textarea: "長い回答", email: "メールアドレス", tel: "電話番号", select: "選択式", checkbox: "チェックボックス" }[t]}
                </option>
              ))}
            </select>
            <label className="flex shrink-0 items-center gap-1 text-xs text-[var(--mikke-text-soft)]">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, required: e.target.checked } : v)))}
              />
              必須
            </label>
          </div>
        </div>
      ))}
    </section>
  );
}
