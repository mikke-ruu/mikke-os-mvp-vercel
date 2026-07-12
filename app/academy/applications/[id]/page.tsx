"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { getCourse } from "@/lib/academy/courses";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_ORDER,
  getApplication,
  updateApplication
} from "@/lib/academy/applications";
import { formatDate } from "@/lib/format";
import type { AcademyApplication, AcademyCourse, AcademyHeadquarters } from "@/types/database";

const inputClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";
const labelClass = "block text-xs font-bold text-[var(--mikke-text-soft)]";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-[var(--mikke-muted)]">{label}</span>
      <span className="text-right font-medium text-[var(--mikke-text)]">{value || "—"}</span>
    </div>
  );
}

function DetailContent({ appId }: { appId: string }) {
  const { profile } = useAuth();
  const router = useRouter();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [app, setApp] = useState<AcademyApplication | null>(null);
  const [course, setCourse] = useState<AcademyCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const foundHq = await getOwnedHeadquarters(profile.user_id);
      setHq(foundHq);
      if (foundHq) {
        const found = await getApplication(foundHq.id, appId);
        setApp(found);
        setCourse(await getCourse(foundHq.id, found.course_id).catch(() => null as unknown as AcademyCourse));
      }
      setLoading(false);
    }
    load();
  }, [profile.user_id, appId]);

  async function apply(patch: Parameters<typeof updateApplication>[3]) {
    if (!hq || !app) return;
    setSaving(true);
    try {
      const next = await updateApplication(profile, hq.id, app, patch);
      setApp(next);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq || !app) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">申込が見つかりません。</p>;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <div className="flex items-center gap-2">
          {course ? <span className="rounded bg-[var(--mikke-accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">{course.code}</span> : null}
          <h2 className="text-base font-bold text-[var(--mikke-text)]">{app.applicant_name}</h2>
        </div>
        <div className="mt-2 divide-y divide-[var(--mikke-line-soft)]">
          <Row label="講座" value={course?.name ?? ""} />
          <Row label="受付元" value={app.intake_source === "koushi" ? "講師受付" : "本部受付"} />
          <Row label="開催日" value={app.event_date ? formatDate(app.event_date) : ""} />
          <Row label="受講形式" value={app.format === "in_person" ? "対面" : app.format === "online" ? "オンライン" : ""} />
          <Row label="受講料" value={`${app.price.toLocaleString()}円`} />
          <Row label="キット仕入れ" value={`${app.kit_cost.toLocaleString()}円`} />
          <Row label="本部売上 / 講師売上" value={`${app.honbu_revenue.toLocaleString()} / ${app.instructor_revenue.toLocaleString()}円`} />
          <Row label="メール" value={app.applicant_email ?? ""} />
          <Row label="電話" value={app.applicant_phone ?? ""} />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <p className="text-xs font-bold text-[var(--mikke-accent)]">ステータス管理</p>
        <div>
          <label className={labelClass}>申込ステータス</label>
          <select
            className={inputClass}
            value={app.status}
            disabled={saving}
            onChange={(e) => apply({ status: e.target.value as AcademyApplication["status"] })}
          >
            {APPLICATION_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {APPLICATION_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>入金状況</label>
            <select
              className={inputClass}
              value={app.payment_status}
              disabled={saving}
              onChange={(e) => apply({ payment_status: e.target.value as AcademyApplication["payment_status"] })}
            >
              <option value="unpaid">未入金</option>
              <option value="paid">入金済み</option>
              <option value="not_required">不要</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>認定状況</label>
            <select
              className={inputClass}
              value={app.certification_status}
              disabled={saving}
              onChange={(e) => apply({ certification_status: e.target.value as AcademyApplication["certification_status"] })}
            >
              <option value="not_yet">未認定</option>
              <option value="pending">認定待ち</option>
              <option value="certified">認定済み</option>
            </select>
          </div>
        </div>
        <p className="text-[11px] text-[var(--mikke-muted)]">
          入金・受講完了・認定は、mikke連携用のイベントとして記録されます（Storyへは個人情報を含めず後で反映）。
        </p>
      </section>

      <button
        type="button"
        onClick={() => router.push("/academy/applications")}
        className="w-full rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-3 text-sm font-bold text-[var(--mikke-text-soft)]"
      >
        一覧に戻る
      </button>
    </div>
  );
}

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <HonbuShell title="申込詳細">
      <div className="mx-auto max-w-2xl">
        <DetailContent appId={id} />
      </div>
    </HonbuShell>
  );
}
