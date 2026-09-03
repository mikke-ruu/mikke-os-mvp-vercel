"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { getOwnedHeadquarters, updateHeadquarters } from "@/lib/academy/headquarters";
import { listCourses } from "@/lib/academy/courses";
import {
  calcRenewalDue,
  createInstructor,
  findExistingInstructorNumber,
  findProfileByHandle,
  type InstructorInput
} from "@/lib/academy/instructors";
import type { AcademyCourse, AcademyHeadquarters } from "@/types/database";

const inputClass =
  "min-w-0 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-base text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)] sm:text-sm";
const labelClass = "block text-xs font-bold text-[var(--mikke-text-soft)]";

function NewInstructorContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSelfRegistration, setIsSelfRegistration] = useState(false);

  // 講師番号: 同一人物が既に他講座で認定済みなら既存番号を引き継ぐ。
  // それ以外は自動採番（有効時）か、なければ手入力。
  const [numberLookup, setNumberLookup] = useState<"idle" | "loading" | "existing" | "auto" | "manual" | "not_found">(
    "idle"
  );
  const [existingProfileName, setExistingProfileName] = useState<string | null>(null);
  const [consumesAutoNumber, setConsumesAutoNumber] = useState(false);

  const [form, setForm] = useState<InstructorInput>({
    courseId: "",
    handle: "",
    instructorNumber: "",
    certifiedAt: "",
    renewalDue: "",
    isCertified: true,
    isActive: true,
    isListed: false,
    acceptsApplications: false,
    businessName: "",
    area: "",
    memo: ""
  });

  useEffect(() => {
    async function load() {
      const foundHq = await getOwnedHeadquarters(profile.user_id);
      setHq(foundHq);
      if (foundHq) setCourses(await listCourses(foundHq.id));
      if (new URLSearchParams(window.location.search).get("self") === "1") {
        setIsSelfRegistration(true);
        setForm((current) => ({
          ...current,
          handle: profile.handle,
          businessName: current.businessName || profile.display_name
        }));
      }
      setLoading(false);
    }
    load();
  }, [profile.display_name, profile.handle, profile.user_id]);

  function set<K extends keyof InstructorInput>(key: K, value: InstructorInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setHandle(value: string) {
    set("handle", value);
    setError(null);
    setNumberLookup("idle");
    setExistingProfileName(null);
    setConsumesAutoNumber(false);
  }

  // 認定日を入れたとき、更新期限が未入力で本部の更新周期が設定されていれば自動計算する。
  // あくまで下書きなので、後から自由に上書きできる。
  function setCertifiedAt(value: string) {
    setForm((prev) => ({
      ...prev,
      certifiedAt: value,
      renewalDue:
        !prev.renewalDue && value && hq?.renewal_period_months
          ? calcRenewalDue(value, hq.renewal_period_months)
          : prev.renewalDue
    }));
  }

  // ハンドル確定時に、同一人物の既存講師番号 or 自動採番の次番号を判定する。
  async function handleHandleBlur() {
    if (!hq || !form.handle.trim()) {
      setNumberLookup("idle");
      return;
    }
    setNumberLookup("loading");
    setExistingProfileName(null);
    setConsumesAutoNumber(false);
    try {
      const target = await findProfileByHandle(form.handle);
      if (!target) {
        setNumberLookup("not_found");
        return;
      }
      const existing = await findExistingInstructorNumber(hq.id, target.id);
      if (existing) {
        setNumberLookup("existing");
        setExistingProfileName(target.display_name);
        set("instructorNumber", existing);
      } else if (hq.next_instructor_number != null) {
        setNumberLookup("auto");
        setConsumesAutoNumber(true);
        set("instructorNumber", String(hq.next_instructor_number));
      } else {
        setNumberLookup("manual");
      }
    } catch {
      setNumberLookup("manual");
    }
  }

  function switchToManualNumber() {
    setNumberLookup("manual");
    setConsumesAutoNumber(false);
    set("instructorNumber", "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.courseId) return setError("講座を選択してください。");
    if (!form.handle.trim()) return setError("講師のmikke IDを入力してください。");
    setSaving(true);
    try {
      await createInstructor(profile, hq!.id, form);
      // 自動採番を使った登録が確定したら、次の番号へ進める。
      if (consumesAutoNumber && hq!.next_instructor_number != null) {
        await updateHeadquarters(hq!.id, { next_instructor_number: hq!.next_instructor_number + 1 });
      }
      router.push(toCurrentAcademyContextHref("/academy/instructors"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました。");
      setSaving(false);
    }
  }

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">先に本部を作成してください。</p>;
  if (courses.length === 0) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">先に講座を作成してください。</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isSelfRegistration ? (
        <section className="rounded-2xl border border-[var(--mikke-accent)]/35 bg-[var(--mikke-accent-soft)] p-4">
          <p className="text-sm font-bold text-[var(--mikke-accent-strong)]">本部オーナー自身を講師として登録します</p>
          <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">実際に講座を教える場合だけ登録してください。登録中は講師1名として利用人数に数えます。講師として使える機能は、同じアカウントのマイポータルに追加されます。</p>
        </section>
      ) : null}
      <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <div>
          <label className={labelClass}>認定講座*</label>
          <select className={inputClass} value={form.courseId} onChange={(e) => set("courseId", e.target.value)}>
            <option value="">選択してください</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>講師のmikke ID*</label>
          <input
            className={inputClass}
            value={form.handle}
            onChange={(e) => setHandle(e.target.value)}
            onBlur={handleHandleBlur}
            placeholder="例: arisa_hattori"
          />
          <p className="mt-1 text-[11px] text-[var(--mikke-muted)]">講師本人がmikkeアカウントを持っている必要があります。mikke IDは「@」から始まる本人確認用の名前です。</p>
          {numberLookup === "loading" ? <p className="mt-1 text-[11px] text-[var(--mikke-muted)]">講師番号を確認中…</p> : null}
          {numberLookup === "not_found" ? (
            <p className="mt-1 text-[11px] font-bold text-[var(--mikke-danger)]">
              このmikke IDが見つかりません。登録時にあらためて確認します。
            </p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <p className="text-xs font-bold text-[var(--mikke-accent)]">認定情報（本部管理）</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className={labelClass}>講師番号</label>
            <input
              className={inputClass}
              value={form.instructorNumber}
              readOnly={numberLookup === "existing" || numberLookup === "auto"}
              onChange={(e) => set("instructorNumber", e.target.value)}
            />
            {numberLookup === "existing" ? (
              <p className="mt-1 text-[11px] text-[var(--mikke-muted)]">
                {existingProfileName ? `${existingProfileName}さんは` : "この方は"}
                他講座で講師番号 {form.instructorNumber} を持っています。同じ番号を引き継ぎます。
              </p>
            ) : numberLookup === "auto" ? (
              <div className="mt-1 flex items-center justify-between">
                <p className="text-[11px] text-[var(--mikke-muted)]">自動採番（次の番号）です。</p>
                <button type="button" onClick={switchToManualNumber} className="text-[11px] font-bold text-[var(--mikke-accent-strong)]">
                  手入力に切り替える
                </button>
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-[var(--mikke-muted)]">
                既存講師は現行の番号を手入力してください。mikke ID入力後、自動採番が有効なら次の番号を提案します。
              </p>
            )}
          </div>
          <div>
            <label className={labelClass}>認定日</label>
            <input type="date" className={inputClass} value={form.certifiedAt} onChange={(e) => setCertifiedAt(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelClass}>更新期限</label>
          <input type="date" className={inputClass} value={form.renewalDue} onChange={(e) => set("renewalDue", e.target.value)} />
          {hq.renewal_period_months ? (
            <p className="mt-1 text-[11px] text-[var(--mikke-muted)]">
              本部設定（{hq.renewal_period_months}ヶ月ごと）から自動計算されます。必要に応じて上書きできます。
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-[var(--mikke-muted)]">本部の更新制度が未設定のため、必要な場合のみ手入力してください。</p>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--mikke-text)]">
          <input type="checkbox" checked={form.isCertified} onChange={(e) => set("isCertified", e.target.checked)} />
          認定資格あり（簡単には剥奪しない）
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--mikke-text)]">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
          活動権限あり（掲載・申込・教材閲覧が可能）
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--mikke-text)]">
          <input type="checkbox" checked={form.isListed} onChange={(e) => set("isListed", e.target.checked)} />
          講師一覧に掲載する
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--mikke-text)]">
          <input type="checkbox" checked={form.acceptsApplications} onChange={(e) => set("acceptsApplications", e.target.checked)} />
          この講師の受付を有効にする
        </label>
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <p className="text-xs font-bold text-[var(--mikke-accent)]">基本情報（講師が後で編集可）</p>
        <div>
          <label className={labelClass}>屋号</label>
          <input className={inputClass} value={form.businessName} onChange={(e) => set("businessName", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>活動地域</label>
          <input className={inputClass} value={form.area} onChange={(e) => set("area", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>本部メモ（非公開）</label>
          <textarea className={`${inputClass} min-h-16`} value={form.memo} onChange={(e) => set("memo", e.target.value)} />
        </div>
      </section>

      {error ? <p className="text-sm font-bold text-[var(--mikke-danger)]">{error}</p> : null}

      <button type="submit" disabled={saving} className="w-full rounded-xl bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
        {saving ? "登録中…" : "講師を登録する"}
      </button>
    </form>
  );
}

export default function NewInstructorPage() {
  return (
    <HonbuShell title="講師を登録">
      <div className="mx-auto max-w-2xl">
        <NewInstructorContent />
      </div>
    </HonbuShell>
  );
}
