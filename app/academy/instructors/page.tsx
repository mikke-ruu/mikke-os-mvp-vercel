"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { AlertTriangle, Hash, Plus, Settings, Users } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { AcademyListTools } from "@/components/academy/AcademyListTools";
import { isAcademyLocalReview } from "@/lib/academy/preview";
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
    <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)} className="rounded-lg border border-[var(--mikke-line)] bg-white p-4">
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
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
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
    <details className="rounded-lg border border-[var(--mikke-line)] bg-white p-4">
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
              className="w-28 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--mikke-accent)]"
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
      className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold ${
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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

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
  const visibleInstructors = instructors.filter(i => `${i.business_name || ""} ${courseMap[i.course_id]?.name || ""} ${i.instructor_number || ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) && (filter === "all" || (filter === "active" ? i.is_active : renewalDueIds.has(i.id))));

  return (
    <div className="space-y-4">
      <div>
        <div>
          <p className="text-xs text-[var(--mikke-muted)]">{hq.name}</p>
          <h2 className="text-2xl font-bold text-[var(--mikke-text)]">講師管理</h2>
          <p className="mt-2 text-sm text-[var(--mikke-muted)]">担当講座・活動状況・更新期限を確認できます。件数は講座ごとの登録数です。</p>
        </div>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--mikke-line)] bg-white p-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--mikke-text)]">講師を追加する</p>
          <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">講師情報を登録します。受講者は、申込詳細で修了・認定を確認した後に講師へ追加できます。</p>
        </div>
        <Link href={toCurrentAcademyContextHref("/academy/instructors/new")} className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-bold text-white sm:w-auto">
          <Plus size={16} /> 講師を登録
        </Link>
      </section>

      {isAcademyLocalReview() ? <section className="rounded-lg border border-[var(--mikke-line)] border-l-4 border-l-[#ffd370] bg-white p-4">
        <h3 className="text-sm font-bold">講師同士の連絡や相談にCommunityを使う</h3>
        <p className="mt-2 text-sm leading-6">本部からのお知らせや先生同士の相談に使う場所です。講師登録だけでは参加せず、案内された先生が承諾して参加します。</p>
        <Link href={`/academy/flow-review?tab=community&from=${encodeURIComponent(toCurrentAcademyContextHref("/academy/instructors?preview=walkthrough"))}`} className="mt-2 inline-flex min-h-11 items-center text-sm text-[var(--mikke-primary)]">招待して参加する流れを見る →</Link>
        <p className="text-xs leading-6">開発専用の見本です。実際の先生への招待送信や、参加権限の変更は行いません。</p>
      </section> : null}
      <AcademyListTools label="講師・担当講座" query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} count={visibleInstructors.length} options={[
        {value:"all",label:"すべて",count:instructors.length},
        {value:"active",label:"活動中",count:instructors.filter(i=>i.is_active).length},
        {value:"renewal",label:"更新の確認",count:renewalDueIds.size}
      ]} />
      {instructors.length > 0 && visibleInstructors.length === 0 ? <p className="py-6 text-sm">条件に合う講師登録がありません。検索語や状態を変えてください。</p> : null}
      {instructors.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--mikke-line)] bg-white p-8 text-center">
          <Users size={28} className="mx-auto text-[var(--mikke-accent)]" />
          <p className="mt-2 text-sm text-[var(--mikke-text-soft)]">まだ講師がいません。</p>
          <p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]">「講師を登録」から追加できます。</p>
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {visibleInstructors.map((ins) => {
            const course = courseMap[ins.course_id];
            return (
              <li key={ins.id}>
                <Link href={toCurrentAcademyContextHref(`/academy/instructors/${ins.id}`)} className="block border border-[var(--mikke-line)] bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--mikke-text)]">
                        {ins.business_name || "（屋号未設定）"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[var(--mikke-muted)]">
                        {course ? `${course.name} · ` : ""}
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
                      <span className="flex items-center gap-1 rounded-lg border border-[var(--mikke-accent)]/30 bg-[var(--mikke-accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">
                        <AlertTriangle size={10} /> 更新期限間近
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm">更新期限：{ins.renewal_due || "設定なし"}</p>
                  <p className="mt-2 text-sm text-[var(--mikke-primary)]">講師情報を確認・編集 →</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <section className="border-t border-[var(--mikke-line)] pt-5"><h3 className="mb-3 text-base font-bold">講師管理の設定</h3><div className="grid gap-3 md:grid-cols-2">
        <RenewalSettings hq={hq} onUpdated={setHq} />
        <InstructorNumberSettings hq={hq} onUpdated={setHq} />
      </div></section>
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
