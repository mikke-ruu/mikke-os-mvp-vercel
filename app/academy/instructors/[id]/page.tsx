"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { RotateCw } from "lucide-react";
import { QrCode } from "@/components/academy/QrCode";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { getCourse } from "@/lib/academy/courses";
import { INSTRUCTOR_STATUS_LABELS, getInstructor, renewInstructor, updateInstructor } from "@/lib/academy/instructors";
import type { AcademyCourse, AcademyHeadquarters, AcademyInstructor } from "@/types/database";

const inputClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";
const labelClass = "block text-xs font-bold text-[var(--mikke-text-soft)]";

function Toggle({
  label,
  checked,
  disabled,
  onChange
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 py-1 text-sm text-[var(--mikke-text)]">
      <span>{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function DetailContent({ instructorId }: { instructorId: string }) {
  const { profile } = useAuth();
  const router = useRouter();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [ins, setIns] = useState<AcademyInstructor | null>(null);
  const [course, setCourse] = useState<AcademyCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    async function load() {
      const foundHq = await getOwnedHeadquarters(profile.user_id);
      setHq(foundHq);
      if (foundHq) {
        const found = await getInstructor(foundHq.id, instructorId);
        setIns(found);
        setCourse(await getCourse(foundHq.id, found.course_id).catch(() => null as unknown as AcademyCourse));
      }
      setLoading(false);
    }
    load();
  }, [profile.user_id, instructorId]);

  async function apply(patch: Parameters<typeof updateInstructor>[2]) {
    if (!hq || !ins) return;
    setSaving(true);
    try {
      setIns(await updateInstructor(hq.id, ins, patch));
    } finally {
      setSaving(false);
    }
  }

  async function handleRenew() {
    if (!hq || !ins || !hq.renewal_period_months) return;
    setSaving(true);
    try {
      setIns(await renewInstructor(profile, hq.id, ins, hq.renewal_period_months));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq || !ins) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">講師が見つかりません。</p>;

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {course ? <span className="rounded bg-[var(--mikke-accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">{course.code}</span> : null}
            <h2 className="text-base font-bold text-[var(--mikke-text)]">{ins.business_name || "（屋号未設定）"}</h2>
          </div>
          <p className="mt-1 text-xs text-[var(--mikke-muted)]">
            {ins.instructor_number ? `講師番号 ${ins.instructor_number}` : "講師番号未設定"}
            {ins.area ? ` ・ ${ins.area}` : ""}
          </p>
          {origin ? <p className="mt-2 truncate text-[11px] text-[var(--mikke-muted-light)]">{origin}/academy/i/{ins.id}</p> : null}
        </div>
        {origin ? (
          <div className="shrink-0 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
            <QrCode url={`${origin}/academy/i/${ins.id}`} filename={`${course?.code ?? "academy"}-${ins.id.slice(0, 8)}`} />
          </div>
        ) : null}
      </section>

      <section className="space-y-1 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <p className="text-xs font-bold text-[var(--mikke-accent)]">資格・活動権限</p>
        <p className="text-[11px] text-[var(--mikke-muted)]">認定資格と活動権限は別。活動なしでも認定は残す設計です。</p>
        <div className="mt-1 divide-y divide-[var(--mikke-line-soft)]">
          <Toggle label="認定資格あり" checked={ins.is_certified} disabled={saving} onChange={(v) => apply({ is_certified: v })} />
          <Toggle label="活動権限あり（掲載・申込・教材閲覧）" checked={ins.is_active} disabled={saving} onChange={(v) => apply({ is_active: v })} />
          <Toggle label="講師一覧に掲載" checked={ins.is_listed} disabled={saving} onChange={(v) => apply({ is_listed: v })} />
          <Toggle label="この講師の受付を有効" checked={ins.accepts_applications} disabled={saving} onChange={(v) => apply({ accepts_applications: v })} />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <p className="text-xs font-bold text-[var(--mikke-accent)]">状態・認定情報</p>
        <div>
          <label className={labelClass}>活動ステータス</label>
          <select
            className={inputClass}
            value={ins.status}
            disabled={saving}
            onChange={(e) => apply({ status: e.target.value as AcademyInstructor["status"] })}
          >
            {(Object.keys(INSTRUCTOR_STATUS_LABELS) as AcademyInstructor["status"][]).map((s) => (
              <option key={s} value={s}>
                {INSTRUCTOR_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>講師番号</label>
            <input
              className={inputClass}
              defaultValue={ins.instructor_number ?? ""}
              onBlur={(e) => e.target.value !== (ins.instructor_number ?? "") && apply({ instructor_number: e.target.value || null })}
            />
          </div>
          <div>
            <label className={labelClass}>更新期限</label>
            <input
              key={ins.renewal_due ?? "empty"}
              type="date"
              className={inputClass}
              defaultValue={ins.renewal_due ?? ""}
              onBlur={(e) => e.target.value !== (ins.renewal_due ?? "") && apply({ renewal_due: e.target.value || null })}
            />
            {hq.renewal_period_months ? (
              <button
                type="button"
                onClick={handleRenew}
                disabled={saving}
                className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-[var(--mikke-accent-strong)] disabled:opacity-60"
              >
                <RotateCw size={11} /> 更新完了（次回を自動設定: +{hq.renewal_period_months}ヶ月）
              </button>
            ) : null}
          </div>
        </div>
        <div>
          <label className={labelClass}>本部メモ（非公開）</label>
          <textarea
            className={`${inputClass} min-h-16`}
            defaultValue={ins.memo ?? ""}
            onBlur={(e) => e.target.value !== (ins.memo ?? "") && apply({ memo: e.target.value || null })}
          />
        </div>
        <p className="text-[11px] text-[var(--mikke-muted)]">入力欄はフォーカスを外すと自動保存されます。</p>
      </section>

      <button
        type="button"
        onClick={() => router.push("/academy/instructors")}
        className="w-full rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-3 text-sm font-bold text-[var(--mikke-text-soft)]"
      >
        一覧に戻る
      </button>
    </div>
  );
}

export default function InstructorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <HonbuShell title="講師詳細">
      <div className="mx-auto max-w-2xl">
        <DetailContent instructorId={id} />
      </div>
    </HonbuShell>
  );
}
