"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Hash, Plus, Settings, Users } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { getOwnedHeadquarters, updateHeadquarters } from "@/lib/academy/headquarters";
import { listCourses } from "@/lib/academy/courses";
import {
  INSTRUCTOR_REGISTRATION_STATUS_LABELS,
  INSTRUCTOR_STATUS_LABELS,
  getRenewalAlerts,
  listInstructors
} from "@/lib/academy/instructors";
import type { AcademyCourse, AcademyHeadquarters, AcademyInstructor } from "@/types/database";

const RENEWAL_PRESETS = [
  { label: "更新制度なし", value: null },
  { label: "6ヶ月ごと", value: 6 },
  { label: "1年ごと", value: 12 },
  { label: "2年ごと", value: 24 },
  { label: "3年ごと", value: 36 }
];

function RenewalSettings({ hq, onUpdated }: { hq: AcademyHeadquarters; onUpdated: (hq: AcademyHeadquarters) => void }) {
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  async function set(value: number | null) {
    setSaving(true);
    try {
      onUpdated(await updateHeadquarters(hq.id, { renewal_period_months: value }));
    } finally {
      setSaving(false);
    }
  }

  const current = RENEWAL_PRESETS.find((p) => p.value === hq.renewal_period_months);

  return (
    <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
      <summary className="flex cursor-pointer items-center justify-between text-xs font-bold text-[var(--mikke-text-soft)]">
        <span className="flex items-center gap-1.5">
          <Settings size={14} className="text-[var(--mikke-accent)]" /> 更新制度の設定
        </span>
        <span className="text-[var(--mikke-muted-light)]">{current?.label ?? `${hq.renewal_period_months}ヶ月ごと`}</span>
      </summary>
      <div className="mt-3 space-y-2">
        <p className="text-[11px] text-[var(--mikke-muted)]">
          認定講師の更新周期を設定します。設定すると、講師登録時の更新期限が自動計算され、講師詳細から「更新完了」操作ができます。更新制度を使わない団体は「更新制度なし」のままで問題ありません。
        </p>
        <div className="flex flex-wrap gap-1.5">
          {RENEWAL_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={saving}
              onClick={() => set(preset.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                hq.renewal_period_months === preset.value
                  ? "border-[var(--mikke-accent)] bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]"
                  : "border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </details>
  );
}

function InstructorNumberSettings({ hq, onUpdated }: { hq: AcademyHeadquarters; onUpdated: (hq: AcademyHeadquarters) => void }) {
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(hq.next_instructor_number != null ? String(hq.next_instructor_number) : "");
  const enabled = hq.next_instructor_number != null;

  async function toggle(nextEnabled: boolean) {
    setSaving(true);
    try {
      if (!nextEnabled) {
        onUpdated(await updateHeadquarters(hq.id, { next_instructor_number: null }));
        setDraft("");
      } else {
        const value = Math.max(1, Number(draft) || 1);
        setDraft(String(value));
        onUpdated(await updateHeadquarters(hq.id, { next_instructor_number: value }));
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveNumber() {
    const value = Math.max(1, Number(draft) || 1);
    setDraft(String(value));
    setSaving(true);
    try {
      onUpdated(await updateHeadquarters(hq.id, { next_instructor_number: value }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
      <summary className="flex cursor-pointer items-center justify-between text-xs font-bold text-[var(--mikke-text-soft)]">
        <span className="flex items-center gap-1.5">
          <Hash size={14} className="text-[var(--mikke-accent)]" /> 講師番号の自動採番
        </span>
        <span className="text-[var(--mikke-muted-light)]">{enabled ? `次の番号: ${hq.next_instructor_number}` : "手入力のみ"}</span>
      </summary>
      <div className="mt-3 space-y-2">
        <p className="text-[11px] text-[var(--mikke-muted)]">
          講師番号は講座ごとではなく、認定講師になった順に本部で通し番号を振ります。同じ方が複数の講座で認定された場合は、最初に割り当てた番号をそのまま引き継ぎます。既存の講師番号は講師登録画面で手入力してください。手入力が済んだら、続きの番号から自動採番を開始できます。
        </p>
        <label className="flex items-center gap-2 text-sm text-[var(--mikke-text)]">
          <input type="checkbox" checked={enabled} disabled={saving} onChange={(e) => toggle(e.target.checked)} />
          自動採番を有効にする
        </label>
        {enabled ? (
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-[var(--mikke-text-soft)]">次に割り当てる番号</label>
            <input
              type="number"
              min={1}
              disabled={saving}
              className="w-28 rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--mikke-accent)]"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveNumber}
            />
          </div>
        ) : null}
      </div>
    </details>
  );
}

function Badge({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
        on ? "border-[var(--mikke-success)]/30 bg-[var(--mikke-success-soft)] text-[var(--mikke-success)]" : "border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] text-[var(--mikke-muted)]"
      }`}
    >
      {label}
    </span>
  );
}

function InstructorsContent() {
  const { profile } = useAuth();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [instructors, setInstructors] = useState<AcademyInstructor[]>([]);
  const [courseMap, setCourseMap] = useState<Record<string, AcademyCourse>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const foundHq = await getOwnedHeadquarters(profile.user_id);
    setHq(foundHq);
    if (foundHq) {
      const [list, courses] = await Promise.all([listInstructors(foundHq.id), listCourses(foundHq.id)]);
      setInstructors(list);
      setCourseMap(Object.fromEntries(courses.map((c) => [c.id, c])));
    }
    setLoading(false);
  }, [profile.user_id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">先に本部を作成してください。</p>;

  const renewalDueIds = new Set(getRenewalAlerts(instructors).map((a) => a.instructor.id));

  return (
    <div className="space-y-4">
      <div>
        <div>
          <p className="text-xs text-[var(--mikke-muted)]">{hq.name}</p>
          <h2 className="text-base font-bold text-[var(--mikke-text)]">講師管理</h2>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <RenewalSettings hq={hq} onUpdated={setHq} />
        <InstructorNumberSettings hq={hq} onUpdated={setHq} />
      </div>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--mikke-text)]">講師を追加する</p>
          <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">講師情報を登録します。受講者は、申込詳細で修了・認定を確認した後に講師へ追加できます。</p>
        </div>
        <Link href="/academy/instructors/new" className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-bold text-white sm:w-auto">
          <Plus size={16} /> 講師を登録
        </Link>
      </section>

      {instructors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-white p-8 text-center">
          <Users size={28} className="mx-auto text-[var(--mikke-accent)]" />
          <p className="mt-2 text-sm text-[var(--mikke-text-soft)]">まだ講師がいません。</p>
          <p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]">「講師を登録」から追加できます。</p>
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {instructors.map((ins) => {
            const course = courseMap[ins.course_id];
            return (
              <li key={ins.id}>
                <Link href={`/academy/instructors/${ins.id}`} className="block rounded-2xl border border-[var(--mikke-line)] bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--mikke-text)]">
                        {ins.business_name || "（屋号未設定）"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[var(--mikke-muted)]">
                        {course ? `${course.code} ` : ""}
                        {ins.instructor_number ? `No.${ins.instructor_number} ・ ` : ""}
                        {ins.registration_status === "withdrawn"
                          ? INSTRUCTOR_REGISTRATION_STATUS_LABELS.withdrawn
                          : INSTRUCTOR_STATUS_LABELS[ins.status]}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge on={ins.is_certified} label={ins.is_certified ? "認定済み" : "未認定"} />
                    <Badge
                      on={ins.registration_status === "registered"}
                      label={INSTRUCTOR_REGISTRATION_STATUS_LABELS[ins.registration_status]}
                    />
                    <Badge on={ins.is_active} label={ins.is_active ? "活動中" : "活動なし"} />
                    <Badge on={ins.is_listed} label={ins.is_listed ? "掲載中" : "非掲載"} />
                    {renewalDueIds.has(ins.id) ? (
                      <span className="flex items-center gap-1 rounded-full border border-[var(--mikke-accent)]/30 bg-[var(--mikke-accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">
                        <AlertTriangle size={10} /> 更新期限間近
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function InstructorsPage() {
  return (
    <HonbuShell title="講師管理">
      <InstructorsContent />
    </HonbuShell>
  );
}
