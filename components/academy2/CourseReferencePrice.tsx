"use client";

import { useEffect, useRef, useState } from "react";
import { getAcademy2CourseSettings, saveAcademy2CourseSettings, type Academy2CourseSettings } from "@/lib/academy2/course-settings";
import styles from "./course-reference-price.module.css";

/** Mount only for an authenticated Academy2-enabled HQ/course editor context. */
export function CourseReferencePrice({ headquartersId, courseId, disabled = false, onDirtyChange }: {
  headquartersId: string; courseId: string; disabled?: boolean; onDirtyChange?: (dirty: boolean) => void;
}) {
  return <ReferencePrice key={`${headquartersId}:${courseId}`} headquartersId={headquartersId} courseId={courseId} disabled={disabled} onDirtyChange={onDirtyChange} />;
}

function ReferencePrice({ headquartersId, courseId, disabled, onDirtyChange }: { headquartersId: string; courseId: string; disabled: boolean; onDirtyChange?: (dirty: boolean) => void }) {
  const [settings, setSettings] = useState<Academy2CourseSettings | null>(null);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    let live = true;
    getAcademy2CourseSettings(headquartersId, courseId).then(result => {
      if (!live) return;
      setSettings(result); setValue(result.reference_price == null ? "" : String(result.reference_price));
    }).catch(cause => { if (live) setError(cause instanceof Error ? cause.message : "参考価格を読み込めませんでした。"); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [headquartersId, courseId]);

  async function refresh() {
    if (busy.current) return;
    busy.current = true; setLoading(true); setError(null);
    try {
      const result = await getAcademy2CourseSettings(headquartersId, courseId);
      setSettings(result);
      if (!edited) setValue(result.reference_price == null ? "" : String(result.reference_price));
      setLatest(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "参考価格を読み込めませんでした。"); }
    finally { busy.current = false; setLoading(false); }
  }
  async function save() {
    if (busy.current || !settings || disabled) return;
    const amount = value.trim() === "" ? null : Number(value);
    if (amount !== null && (!/^\d+$/.test(value.trim()) || !Number.isSafeInteger(amount))) {
      setError("単品参考価格は0円以上の整数で入力してください。未設定の場合は空欄にします。"); return;
    }
    busy.current = true; setSaving(true); setSaved(false); setError(null);
    try {
      const result = await saveAcademy2CourseSettings(headquartersId, courseId, settings.revision, amount, settings.all_courses_eligible);
      setSettings(result); setEdited(false); onDirtyChange?.(false); setSaved(true); setLatest(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "参考価格を保存できませんでした。"); }
    finally { busy.current = false; setSaving(false); }
  }
  return <div className={styles.field}>
    <label htmlFor={`reference-price-${courseId}`}>単品参考価格（円）</label>
    <p className={styles.hint}>販売プランの価格を決めるときの参考にします。実際の販売価格は販売プランで設定します。</p>
    <input id={`reference-price-${courseId}`} inputMode="numeric" onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void save(); } }} value={value} placeholder="未設定" disabled={disabled || loading || saving || !settings} onChange={event => { setValue(event.target.value); setEdited(true); onDirtyChange?.(true); setSaved(false); setLatest(false); setError(null); }} />
    <div className={styles.actions}><button type="button" disabled={disabled || loading || saving || !settings || !edited} onClick={save}>{saving ? "保存中…" : "参考価格を保存"}</button></div>
    <p role="status" className={styles.hint}>{loading ? "読み込み中…" : saving ? "保存中…" : saved ? "参考価格を保存しました。" : edited ? "参考価格は未保存です。" : settings ? "保存済みの設定です。" : ""}</p>
    {error && <div role="alert" className={styles.error}><p>{error}</p>{edited && <p>入力内容は残っています。</p>}<button type="button" disabled={loading || saving || disabled} onClick={refresh}>最新の設定を確認</button></div>}
    {latest && settings && <p className={styles.hint}>現在の保存値：{settings.reference_price == null ? "未設定" : `${settings.reference_price.toLocaleString("ja-JP")}円`}{edited ? "。入力中の価格は変更していません。内容を確認して保存してください。" : ""}</p>}
  </div>;
}
