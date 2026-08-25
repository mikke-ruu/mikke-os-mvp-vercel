"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AcademyImageUploader } from "@/components/academy/AcademyImageUploader";
import type {
  AcademyCourseFeatureSettings,
  AcademyCoursePortalFeatureSettings,
  AcademyFaqItem,
  AcademyFormField
} from "@/types/database";
import type { CourseInput } from "@/lib/academy/courses";
import { DEFAULT_ACADEMY_COURSE_FEATURE_SETTINGS } from "@/lib/academy/course-feature-settings";

const FIELD_TYPES: AcademyFormField["type"][] = ["text", "textarea", "email", "tel", "select", "checkbox"];

const COURSE_FEATURES: Array<{ key: keyof Omit<AcademyCourseFeatureSettings, "portal">; label: string; description: string; location: string }> = [
  { key: "stepLearning", label: "オンラインのステップ教材", description: "動画・文章・課題を順番に学ぶページを作ります。", location: "ステップ教材" },
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
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";
const labelClass = "block text-xs font-bold text-[var(--mikke-text-soft)]";

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

  function set<K extends keyof CourseInput>(key: K, value: CourseInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleFormat(value: "in_person" | "online") {
    setForm((prev) => ({
      ...prev,
      formats: prev.formats.includes(value)
        ? prev.formats.filter((f) => f !== value)
        : [...prev.formats, value]
    }));
  }

  function toggleCourseFeature(key: keyof Omit<AcademyCourseFeatureSettings, "portal">) {
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
    setForm((prev) => ({
      ...prev,
      featureSettings: {
        ...prev.featureSettings,
        portal: { ...prev.featureSettings.portal, [key]: !prev.featureSettings.portal[key] }
      }
    }));
  }

  function setCoursePageMode(mode: "application" | "introduction" | "none") {
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
      setError("講座名は必須です。");
      return;
    }
    if (form.learnerAccessMode.startsWith("days_after_") && (!form.learnerAccessDays || form.learnerAccessDays < 1 || form.learnerAccessDays > 3650)) {
      setError("教材を見られる日数は、1日から3650日の間で入力してください。");
      return;
    }
    if (form.learnerAccessMode === "fixed_end" && (!form.learnerAccessFixedEndAt || Number.isNaN(new Date(form.learnerAccessFixedEndAt).getTime()))) {
      setError("教材の閲覧終了日時を入力してください。");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        code: form.code.trim() || `COURSE-${Date.now().toString().slice(-8)}`
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1">
            <label className={labelClass}>管理用コード（任意）</label>
            <input className={inputClass} value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="CACM" />
            <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">本部内で講座を区別する番号です。英数字とハイフンを推奨します。空欄なら自動で作成します。</p>
          </div>
          <div className="col-span-2">
            <label className={labelClass}>講座名*</label>
            <input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="コンテナアロマキャンドル認定講座" />
            <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">講座名を入力してください。後から変更できます。</p>
          </div>
        </div>
        <div>
          <label className={labelClass}>サブタイトル</label>
          <input className={inputClass} value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>メイン画像</label>
          <AcademyImageUploader currentUrl={form.mainImageUrl || undefined} onUploaded={(url) => set("mainImageUrl", url)} />
        </div>
        <div>
          <label className={labelClass}>講座説明</label>
          <textarea className={`${inputClass} min-h-24`} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <p className="text-xs font-bold text-[var(--mikke-accent)]">受講者が支払う金額</p>
        <div>
          <label className={labelClass}>受講料（税込・円）</label>
          <input type="number" min={0} className={inputClass} value={form.price} onChange={(e) => set("price", Number(e.target.value) || 0)} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className={labelClass}>受講者の決済方法</label>
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
            <input className={inputClass} value={form.paymentUrl} onChange={(e) => set("paymentUrl", e.target.value)} placeholder="https://…" />
          </div>
        </div>
        <p className="text-sm leading-6 text-[var(--mikke-muted)]">ここは、受講者が講座を申し込むときの料金と決済先です。</p>
        <div className="border-t border-[var(--mikke-line-soft)] pt-3">
          <p className="text-xs font-bold text-[var(--mikke-accent)]">開催方法と認定</p>
        </div>
        <div>
          <label className={labelClass}>所要時間（目安）</label>
          <input className={inputClass} value={form.durationText} onChange={(e) => set("durationText", e.target.value)} placeholder="約3時間" />
        </div>
        <div>
          <label className={labelClass}>受講形式</label>
          <div className="mt-1 flex gap-2">
            {(["in_person", "online"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => toggleFormat(f)}
                className={`rounded-full border px-3 py-1 text-xs font-bold ${
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
        <div>
          <label className={labelClass}>認定条件</label>
          <textarea className={`${inputClass} min-h-16`} value={form.certificationConditions} onChange={(e) => set("certificationConditions", e.target.value)} />
          <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">例：講座修了、本人の講師活動への意思、規約への同意、mikke Communityまたは外部コミュニティへの参加、本部の承認。認定証の自動発送を設定する項目ではありません。</p>
        </div>
        <div>
          <label className={labelClass}>受講後にできること</label>
          <textarea className={`${inputClass} min-h-16`} value={form.canDoAfter} onChange={(e) => set("canDoAfter", e.target.value)} />
        </div>
        <div className="border-t border-[var(--mikke-line-soft)] pt-3">
          <p className="text-xs font-bold text-[var(--mikke-accent)]">認定講師が仕入れるもの</p>
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>講師の講座仕入代（税込）</label>
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
                className={`rounded-xl border p-3 text-left ${selected ? "border-[#3f4eb5] bg-[#3f4eb5] text-white" : "border-[var(--mikke-line)] bg-white text-[var(--mikke-text)]"}`}
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

      <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <div>
          <p className="text-sm font-bold text-[var(--mikke-text)]">公開講座ページ</p>
          <p className="mt-1 text-sm leading-6 text-[var(--mikke-muted)]">1つの講座の内容・料金・開催方法を紹介し、必要に応じて申込も受け付けるページです。本部全体のホームページとは別です。</p>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {([
            ["application", "講座を紹介して、申込も受け付ける", "紹介と申込フォームを表示"],
            ["introduction", "講座の紹介だけ掲載する", "申込は電話や外部フォームなどで受付"],
            ["none", "ページを作らない", "Academy上に講座の紹介ページを出さない"]
          ] as const).map(([mode, title, description]) => {
            const selected = mode === "application"
              ? form.featureSettings.publicCoursePage && form.featureSettings.applications
              : mode === "introduction"
                ? form.featureSettings.publicCoursePage && !form.featureSettings.applications
                : !form.featureSettings.publicCoursePage;
            return (
              <button key={mode} type="button" aria-pressed={selected} onClick={() => setCoursePageMode(mode)} className={`rounded-xl border p-3 text-left ${selected ? "border-[#3f4eb5] bg-[#3f4eb5] text-white" : "border-[var(--mikke-line)] bg-white text-[var(--mikke-text)]"}`}>
                <span className="block text-sm font-bold">{title}</span>
                <span className={`mt-1 block text-[11px] leading-5 ${selected ? "text-white/90" : "text-[var(--mikke-muted)]"}`}>{description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <div>
          <p className="text-xs font-bold text-[var(--mikke-accent)]">質問から設定した機能</p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">この講座で使える機能と、どこで設定するかを表示しています。</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {COURSE_FEATURES.filter((feature) => form.featureSettings[feature.key]).map((feature) => (
            <div key={feature.key} className="rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
              <p className="text-sm font-bold text-[var(--mikke-text)]">{feature.label}</p>
              <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">{feature.description}</p>
              <p className="mt-2 text-[10px] font-bold text-[var(--mikke-accent-strong)]">設定する場所：{feature.location}</p>
            </div>
          ))}
        </div>

        <details className="border-t border-[var(--mikke-line)] pt-4">
          <summary className="cursor-pointer text-xs font-bold text-[var(--mikke-accent-strong)]">詳細な機能設定を変更する</summary>
          <p className="mt-2 text-[11px] leading-5 text-[var(--mikke-muted)]">通常は質問で選んだ設定のままで使えます。後から必要になった機能だけ変更してください。</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {COURSE_FEATURES.map((feature) => (
              <label key={feature.key} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--mikke-line)] bg-white p-3 text-sm text-[var(--mikke-text)]">
                <span><span className="block font-bold">{feature.label}</span><span className="mt-1 block text-[11px] leading-5 text-[var(--mikke-muted)]">{feature.description}</span></span>
                <input className="mt-1" type="checkbox" checked={form.featureSettings[feature.key]} onChange={() => toggleCourseFeature(feature.key)} />
              </label>
            ))}
          </div>

          <div className="mt-4 border-t border-[var(--mikke-line)] pt-4">
            <p className="text-xs font-bold text-[var(--mikke-accent)]">マイポータルに追加する機能</p>
            <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">受講者は教材や復習を確認し、認定講師になった人には申込・開催・発注などの機能を追加します。</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PORTAL_FEATURES.map((feature) => (
                <label key={feature.key} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--mikke-line)] p-3 text-sm text-[var(--mikke-text)]">
                  <span><span className="block font-bold">{feature.label}</span><span className="mt-1 block text-[11px] leading-5 text-[var(--mikke-muted)]">{feature.description}</span></span>
                  <input className="mt-1" type="checkbox" checked={form.featureSettings.portal[feature.key]} onChange={() => togglePortalFeature(feature.key)} />
                </label>
              ))}
            </div>
          </div>
        </details>
      </section>

      <FaqEditor value={form.faq} onChange={(v) => set("faq", v)} />
      <FormFieldEditor value={form.applicationFormFields} onChange={(v) => set("applicationFormFields", v)} />

      <section className="space-y-2 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <p className="text-xs font-bold text-[var(--mikke-accent)]">受付設定</p>
        <label className="flex items-center gap-2 text-sm text-[var(--mikke-text)]">
          <input type="checkbox" checked={form.acceptAtHonbu} onChange={(e) => set("acceptAtHonbu", e.target.checked)} />
          本部受付を有効にする
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--mikke-text)]">
          <input type="checkbox" checked={form.acceptAtKoushi} onChange={(e) => set("acceptAtKoushi", e.target.checked)} />
          講師受付を有効にする
        </label>
      </section>

      {error ? <p className="text-sm font-bold text-[var(--mikke-danger)]">{error}</p> : null}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
      >
        {saving ? "保存中…" : submitLabel}
      </button>
    </form>
  );
}

function FaqEditor({ value, onChange }: { value: AcademyFaqItem[]; onChange: (v: AcademyFaqItem[]) => void }) {
  return (
    <section className="space-y-2 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-[var(--mikke-accent)]">FAQ</p>
        <button type="button" onClick={() => onChange([...value, { q: "", a: "" }])} className="flex items-center gap-1 text-xs font-bold text-[var(--mikke-accent-strong)]">
          <Plus size={14} /> 追加
        </button>
      </div>
      {value.length === 0 ? <p className="text-xs text-[var(--mikke-muted)]">まだありません。</p> : null}
      {value.map((item, i) => (
        <div key={i} className="space-y-1 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-2">
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
    <section className="space-y-2 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-[var(--mikke-accent)]">申込フォーム項目</p>
        <button type="button" onClick={add} className="flex items-center gap-1 text-xs font-bold text-[var(--mikke-accent-strong)]">
          <Plus size={14} /> 追加
        </button>
      </div>
      <p className="text-[11px] text-[var(--mikke-muted)]">氏名・連絡先は既定で収集します。ここは講座固有の質問だけ追加します。</p>
      {value.map((field, i) => (
        <div key={i} className="space-y-1 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-2">
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
                  {t}
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
