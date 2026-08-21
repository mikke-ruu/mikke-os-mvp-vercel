"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { RotateCw, UserMinus } from "lucide-react";
import { QrCode } from "@/components/academy/QrCode";
import { MikkeMediaPicker } from "@/components/media/MikkeMediaPicker";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { getCourse } from "@/lib/academy/courses";
import {
  INSTRUCTOR_REGISTRATION_STATUS_LABELS,
  INSTRUCTOR_STATUS_LABELS,
  getInstructor,
  renewInstructor,
  updateInstructor,
  withdrawInstructor
} from "@/lib/academy/instructors";
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

  async function handleWithdraw() {
    if (!ins) return;
    const confirmed = window.confirm(
      "この講師を登録解除します。翌月から課金対象外となり、Academyは利用できなくなります。認定日・講師番号などの台帳は非公開で残ります。続けますか？"
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      setIns(await withdrawInstructor(ins.id));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq || !ins) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">講師が見つかりません。</p>;

  const isWithdrawn = ins.registration_status === "withdrawn";

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
          <p className="mt-2 text-xs font-bold text-[var(--mikke-accent-strong)]">
            {INSTRUCTOR_REGISTRATION_STATUS_LABELS[ins.registration_status]}
            {ins.withdrawn_at ? ` ・ ${new Date(ins.withdrawn_at).toLocaleDateString("ja-JP")}解除` : ""}
          </p>
          {origin && !isWithdrawn ? <p className="mt-2 truncate text-[11px] text-[var(--mikke-muted-light)]">{origin}/academy/i/{ins.id}</p> : null}
        </div>
        {origin && !isWithdrawn ? (
          <div className="shrink-0 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
            <QrCode url={`${origin}/academy/i/${ins.id}`} filename={`${course?.code ?? "academy"}-${ins.id.slice(0, 8)}`} />
          </div>
        ) : null}
      </section>

      <section className="space-y-1 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <p className="text-xs font-bold text-[var(--mikke-accent)]">資格・活動権限</p>
        <p className="text-[11px] text-[var(--mikke-muted)]">認定資格と活動権限は別。活動なしでも認定は残す設計です。</p>
        <div className="mt-1 divide-y divide-[var(--mikke-line-soft)]">
          <Toggle label="認定資格あり" checked={ins.is_certified} disabled={saving || isWithdrawn} onChange={(v) => apply({ is_certified: v })} />
          <Toggle label="活動権限あり（掲載・申込・教材閲覧）" checked={ins.is_active} disabled={saving || isWithdrawn} onChange={(v) => apply({ is_active: v })} />
          <Toggle label="講師一覧に掲載" checked={ins.is_listed} disabled={saving || isWithdrawn} onChange={(v) => apply({ is_listed: v })} />
          <Toggle label="この講師の受付を有効" checked={ins.accepts_applications} disabled={saving || isWithdrawn} onChange={(v) => apply({ accepts_applications: v })} />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <p className="text-xs font-bold text-[var(--mikke-accent)]">状態・認定情報</p>
        <div>
          <label className={labelClass}>活動ステータス</label>
          <select
            className={inputClass}
            value={ins.status}
            disabled={saving || isWithdrawn}
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

      <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <p className="text-xs font-bold text-[var(--mikke-accent)]">掲載情報（写真・紹介文）</p>
        <p className="text-[11px] text-[var(--mikke-muted)]">
          講師ページや講師一覧など公開ページに表示されます。講師本人も講師ポータルから編集できます。
        </p>
        <div>
          <label className={labelClass}>講師写真</label>
          <div className="mt-1">
            <MikkeMediaPicker
              sourceApp="academy"
              currentUrl={ins.photo_url ?? undefined}
              onSelect={(asset) => apply({ photo_url: asset.publicUrl })}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>紹介文（自由記述）</label>
          <textarea
            className={`${inputClass} min-h-24`}
            defaultValue={ins.self_intro ?? ""}
            onBlur={(e) => e.target.value !== (ins.self_intro ?? "") && apply({ self_intro: e.target.value || null })}
          />
        </div>
        <p className="text-[11px] text-[var(--mikke-muted)]">入力欄はフォーカスを外すと自動保存されます。</p>
      </section>

      {!isWithdrawn ? (
        <section className="space-y-2 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
          <p className="text-xs font-bold text-[var(--mikke-text-soft)]">登録契約</p>
          <p className="text-[11px] text-[var(--mikke-muted)]">
            登録解除するとAcademyの利用と公開を停止します。認定日・講師番号などは本部の非公開台帳として残ります。
          </p>
          <button
            type="button"
            onClick={handleWithdraw}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-3 text-sm font-bold text-[var(--mikke-text-soft)] disabled:opacity-60"
          >
            <UserMinus size={16} /> 登録解除
          </button>
        </section>
      ) : (
        <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4">
          <p className="text-xs font-bold text-[var(--mikke-text-soft)]">非公開の認定台帳</p>
          <p className="mt-1 text-[11px] text-[var(--mikke-muted)]">
            この講師は登録解除済みです。Academyの利用・公開・受付は停止しています。認定日と講師番号は履歴として保持します。
          </p>
        </section>
      )}

      <button
        type="button"
        onClick={() => router.push(toCurrentAcademyContextHref("/academy/instructors"))}
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
