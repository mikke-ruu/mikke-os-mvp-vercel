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

const COURSE_FEATURES: Array<{ key: keyof Omit<AcademyCourseFeatureSettings, "portal">; label: string }> = [
  { key: "stepLearning", label: "ステップ教材" },
  { key: "materialLicenses", label: "教材ライセンス" },
  { key: "materialAssignments", label: "教材の割り当て" },
  { key: "applications", label: "申込" },
  { key: "classes", label: "開催・受講者" },
  { key: "kits", label: "キット受注" },
  { key: "certification", label: "認定" },
  { key: "renewal", label: "更新" },
  { key: "subscriptions", label: "月額契約" },
  { key: "publicCoursePage", label: "講座ページ" }
];

const PORTAL_FEATURES: Array<{ key: keyof AcademyCoursePortalFeatureSettings; label: string }> = [
  { key: "learning", label: "受講教材" },
  { key: "applications", label: "申込管理" },
  { key: "classes", label: "開催回" },
  { key: "approvals", label: "提出・確認" },
  { key: "kits", label: "キット" },
  { key: "procurement", label: "資材発注" },
  { key: "credentials", label: "認定業務" },
  { key: "subscription", label: "契約状況" }
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
    kitPrice: 0,
    kitPaymentUrl: "",
    requiresKit: true,
    featureSettings: {
      ...DEFAULT_ACADEMY_COURSE_FEATURE_SETTINGS,
      portal: { ...DEFAULT_ACADEMY_COURSE_FEATURE_SETTINGS.portal }
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.code.trim() || !form.name.trim()) {
      setError("講座コードと講座名は必須です。");
      return;
    }
    setSaving(true);
    try {
      await onSubmit(form);
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
            <label className={labelClass}>講座コード*</label>
            <input className={inputClass} value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="CACM" />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>講座名*</label>
            <input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="コンテナアロマキャンドル認定講座" />
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
        <p className="text-xs font-bold text-[var(--mikke-accent)]">受講条件・料金</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>受講料（円）</label>
            <input type="number" min={0} className={inputClass} value={form.price} onChange={(e) => set("price", Number(e.target.value) || 0)} />
          </div>
          <div>
            <label className={labelClass}>所要時間</label>
            <input className={inputClass} value={form.durationText} onChange={(e) => set("durationText", e.target.value)} placeholder="約3時間" />
          </div>
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
        </div>
        <div>
          <label className={labelClass}>受講後にできること</label>
          <textarea className={`${inputClass} min-h-16`} value={form.canDoAfter} onChange={(e) => set("canDoAfter", e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--mikke-text)]">
          <input
            type="checkbox"
            checked={form.featureSettings.kits}
            onChange={() => toggleCourseFeature("kits")}
          />
          この講座はキット（教材）を販売する
        </label>
        {form.featureSettings.kits ? (
          <>
            <div>
              <label className={labelClass}>キット内容</label>
              <textarea className={`${inputClass} min-h-16`} value={form.kitContents} onChange={(e) => set("kitContents", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>キット代金（円）</label>
                <input type="number" min={0} className={inputClass} value={form.kitPrice} onChange={(e) => set("kitPrice", Number(e.target.value) || 0)} />
              </div>
              <div>
                <label className={labelClass}>キット代金 決済URL</label>
                <input className={inputClass} value={form.kitPaymentUrl} onChange={(e) => set("kitPaymentUrl", e.target.value)} placeholder="https://…" />
              </div>
            </div>
          </>
        ) : null}
        <div>
          <label className={labelClass}>教材内容</label>
          <textarea className={`${inputClass} min-h-16`} value={form.materialContents} onChange={(e) => set("materialContents", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>受講料 決済URL（外部）</label>
          <input className={inputClass} value={form.paymentUrl} onChange={(e) => set("paymentUrl", e.target.value)} placeholder="https://…" />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <div>
          <p className="text-xs font-bold text-[var(--mikke-accent)]">講座で使う機能</p>
          <p className="mt-1 text-[11px] text-[var(--mikke-muted)]">
            OFFにした機能は、この講座の管理画面と受講者ポータルから順次非表示になります。
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {COURSE_FEATURES.map((feature) => (
            <label
              key={feature.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-3 py-2 text-sm text-[var(--mikke-text)]"
            >
              <span>{feature.label}</span>
              <input
                type="checkbox"
                checked={form.featureSettings[feature.key]}
                onChange={() => toggleCourseFeature(feature.key)}
              />
            </label>
          ))}
        </div>

        <div className="border-t border-[var(--mikke-line)] pt-4">
          <p className="text-xs font-bold text-[var(--mikke-accent)]">受講者・サポーターポータル</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {PORTAL_FEATURES.map((feature) => (
              <label
                key={feature.key}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-sm text-[var(--mikke-text)]"
              >
                <span>{feature.label}</span>
                <input
                  type="checkbox"
                  checked={form.featureSettings.portal[feature.key]}
                  onChange={() => togglePortalFeature(feature.key)}
                />
              </label>
            ))}
          </div>
        </div>
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
