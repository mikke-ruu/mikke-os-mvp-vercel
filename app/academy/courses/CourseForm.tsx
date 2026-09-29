"use client";

import { useRef, useState, type ReactNode } from "react";
import { AcademyCourseInput } from "@/components/academy/AcademyCourseInput";
import { AcademyCourseCard } from "@/components/academy/AcademyCourseCard";
import courseStyles from "@/components/academy/academy-course-input.module.css";
import type { CourseInput } from "@/lib/academy/courses";
import { DEFAULT_ACADEMY_COURSE_FEATURE_SETTINGS } from "@/lib/academy/course-feature-settings";
import { getAcademyCourseSaveErrorMessage } from "@/lib/academy/course-save-errors";

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
  onSubmit,
  onNext,
  onDirtyChange,
  disabled = false,
  referencePriceField,
  referencePriceDirty = false,
  basicOnly = false,
  onReload
}: {
  initial?: Partial<CourseInput>;
  submitLabel: string;
  onSubmit: (input: CourseInput) => Promise<void>;
  onNext?: (input: CourseInput) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  disabled?: boolean;
  /** Only the Academy2 authorized route provides this; legacy course.price stays untouched. */
  referencePriceField?: ReactNode;
  referencePriceDirty?: boolean;
  basicOnly?: boolean;
  onReload?: () => Promise<void>;
}) {
  const [form, setForm] = useState<CourseInput>({ ...emptyInput(), ...initial });
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [phonePreview, setPhonePreview] = useState(false);
  const imageSide = form.featureSettings.marketing?.imageSide ?? "left";
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(false);
  function showError(message: string) {
    setError(message);
    requestAnimationFrame(() => {
      errorRef.current?.focus({ preventScroll: true });
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function set<K extends keyof CourseInput>(key: K, value: CourseInput[K]) {
    onDirtyChange?.(true);
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current || disabled) return;
    const next = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("data-next") === "true";
    if (next && referencePriceDirty) { showError("単品参考価格が未保存です。参考価格を保存してから進んでください。"); return; }
    setError(null);
    setSaved(false);
    if (!form.name.trim()) {
      showError("講座名は必須です。");
      return;
    }
    if (referencePriceField === undefined && (!Number.isSafeInteger(form.price) || form.price < 0)) {
      showError("基本価格は0円以上の整数で入力してください。");
      return;
    }
    onDirtyChange?.(true);
    submitting.current = true;
    setSaving(true);
    try {
      await (next && onNext ? onNext : onSubmit)({
        ...form,
        code: form.code.trim() || `COURSE-${Date.now().toString().slice(-8)}`
      });
      setSaved(true);
      onDirtyChange?.(false);
    } catch (err) {
      showError(basicOnly && err instanceof Error ? err.message : getAcademyCourseSaveErrorMessage(err));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={courseStyles.root}>
      {error ? <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-lg border border-[var(--mikke-danger)] bg-red-50 p-3 text-sm outline-none">{error}<p className="mt-1">入力内容は残っています。</p>{onReload && <button type="button" disabled={saving || disabled} onClick={async () => {
        if (submitting.current) return;
        submitting.current = true; setSaving(true);
        try { await onReload(); setError("最新の保存状態を確認しました。入力内容は変更していません。内容を確認して保存してください。"); }
        catch (cause) { showError(cause instanceof Error ? cause.message : "最新の保存状態を確認できませんでした。"); }
        finally { submitting.current = false; setSaving(false); }
      }}>最新の保存状態を確認</button>}</div> : null}
      <fieldset disabled={saving || disabled} className="min-w-0 disabled:opacity-70">
        <nav className={courseStyles.steps} aria-label="講座作成の手順"><button type="button" aria-current="step">1 講座情報</button>{onNext && <button type="submit" data-next="true">2 レッスン教材</button>}</nav>
        <AcademyCourseInput value={form} onChange={set} priceField={referencePriceField} basicOnly={basicOnly} />
      <details aria-label="講座カードプレビュー" className={courseStyles.preview}>
        <summary className="cursor-pointer text-base font-bold">講座カードプレビュー</summary>
        <div className={courseStyles.previewTools}>
          <button type="button" aria-pressed={!phonePreview} onClick={() => setPhonePreview(false)} className="min-h-11 rounded-lg border border-[var(--mikke-line)] px-3 aria-pressed:bg-[var(--mikke-accent-soft)]">PC</button>
          <button type="button" aria-pressed={phonePreview} onClick={() => setPhonePreview(true)} className="min-h-11 rounded-lg border border-[var(--mikke-line)] px-3 aria-pressed:bg-[var(--mikke-accent-soft)]">スマホ</button>
          <label className="flex items-center gap-2">PCの画像位置<select className="min-h-11 rounded-lg border border-[var(--mikke-line)] bg-white px-2 text-base" value={imageSide} onChange={event => set("featureSettings", { ...form.featureSettings, marketing: { ...form.featureSettings.marketing, imageSide: event.target.value as "left" | "right" } })}><option value="left">左</option><option value="right">右</option></select></label>
        </div>
        <div className={courseStyles.previewCard} data-phone={phonePreview}>
          <AcademyCourseCard course={{ feature_settings: form.featureSettings, name: form.name || "講座名", price: form.price, subtitle: form.subtitle, main_image_url: form.mainImageUrl, description: form.description, can_do_after: form.canDoAfter, duration_text: form.durationText, kit_contents: form.kitContents, material_contents: form.materialContents }} imageSide={imageSide} priceLabel="基本価格（税込）" hidePrice={referencePriceField !== undefined} />
        </div>
        <p className={courseStyles.note}>{basicOnly ? "販売ページでは、販売プランで設定した価格を表示します。" : "サービスページでは、サービスで設定した価格を表示します。"}</p>
      </details>
      </fieldset>
      {saved ? <p role="status" className="text-sm">{basicOnly ? "講座の基本情報を保存しました。" : "変更を保存しました"}{referencePriceDirty ? "単品参考価格は未保存です。" : ""}</p> : null}
      <p className="text-xs leading-5 text-[var(--mikke-muted)]">{basicOnly ? "販売方法や実際の価格は販売プランで設定します。単品参考価格は講座保存後に個別に設定・保存できます。" : "講座を保存したら「サービス」でサービスページを作成・公開します。"}</p>
      {onNext ? <div className={courseStyles.next}><button type="submit" data-next="true" disabled={saving || disabled}>次へ：レッスン教材</button></div> : null}
      <div className={courseStyles.savebar}><button type="submit" title={submitLabel} disabled={saving || disabled}>{saving ? "保存中…" : "保存する"}</button></div>
    </form>
  );
}
