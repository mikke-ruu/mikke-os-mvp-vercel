"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BookOpen, ClipboardList, Heart, JapaneseYen, Package, Users } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { ensureHeadquarters, getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { listCourses } from "@/lib/academy/courses";
import { getRenewalAlerts, listInstructors } from "@/lib/academy/instructors";
import { APPLICATION_STATUS_LABELS, listApplications } from "@/lib/academy/applications";
import { listKitOrders } from "@/lib/academy/kits";
import type {
  AcademyApplication,
  AcademyCourse,
  AcademyHeadquarters,
  AcademyInstructor,
  AcademyKitOrder
} from "@/types/database";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  detail,
  alert
}: {
  icon: typeof BookOpen;
  label: string;
  value: number;
  sub?: string;
  detail?: string;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-3.5 md:p-4 ${alert ? "border-[var(--mikke-accent)]/40 bg-[var(--mikke-accent-soft)]" : "border-[var(--mikke-line)] bg-white"}`}>
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${alert ? "bg-white text-[var(--mikke-accent)]" : "bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]"}`}>
          <Icon size={16} />
        </span>
        <p className="text-xs font-bold text-[var(--mikke-muted)]">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold text-[var(--mikke-text)]">
        {value.toLocaleString()}
        <span className="ml-1 text-xs font-bold text-[var(--mikke-muted-light)]">{sub}</span>
      </p>
      {detail ? <p className="mt-1 truncate text-[11px] text-[var(--mikke-muted)]">{detail}</p> : null}
    </div>
  );
}

function DashboardContent() {
  const { profile } = useAuth();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [instructors, setInstructors] = useState<AcademyInstructor[]>([]);
  const [apps, setApps] = useState<AcademyApplication[]>([]);
  const [kits, setKits] = useState<AcademyKitOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const foundHq = await getOwnedHeadquarters(profile.user_id);
      setHq(foundHq);
      if (foundHq) {
        const [c, i, a, k] = await Promise.all([
          listCourses(foundHq.id),
          listInstructors(foundHq.id),
          listApplications(foundHq.id),
          listKitOrders(foundHq.id)
        ]);
        setCourses(c);
        setInstructors(i);
        setApps(a);
        setKits(k);
      }
      setLoading(false);
    }
    load();
  }, [profile.user_id]);

  async function initHq() {
    setLoading(true);
    const created = await ensureHeadquarters(profile, `${profile.display_name}アカデミー`);
    setHq(created);
    setLoading(false);
  }

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;

  if (!hq) {
    return (
      <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-6 text-center">
        <p className="text-sm font-bold text-[var(--mikke-text)]">本部がまだありません</p>
        <p className="text-xs text-[var(--mikke-muted)]">認定講座を管理する本部を作成します。</p>
        <button onClick={initHq} className="rounded-xl bg-[var(--mikke-accent)] px-4 py-2 text-sm font-bold text-white">
          本部を作成する
        </button>
      </div>
    );
  }

  const pendingApps = apps.filter((a) => a.status === "received");
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthApps = apps.filter((a) => a.created_at.startsWith(monthKey));
  const pendingKits = kits.filter((k) => ["received", "awaiting_payment", "paid", "preparing"].includes(k.status));
  const recentApps = apps.slice(0, 5);
  const courseMap = Object.fromEntries(courses.map((c) => [c.id, c]));
  const renewalAlerts = getRenewalAlerts(instructors);

  const publishedCourses = courses.filter((c) => c.is_published).length;
  const activeInstructors = instructors.filter((i) => i.is_active).length;
  const honbuIntake = monthApps.filter((a) => a.intake_source !== "koushi").length;
  const koushiIntake = monthApps.filter((a) => a.intake_source === "koushi").length;
  const oldestPendingApp = pendingApps[pendingApps.length - 1];
  const oldestPendingDays = oldestPendingApp
    ? Math.max(0, Math.floor((Date.now() - new Date(oldestPendingApp.created_at).getTime()) / 86400000))
    : 0;

  // Wave F (AC-F6): 「今月の売上」「累計売上」= 本部受付申込のhonbu_revenue(payment_status=paid)
  // ＋キット発注のamount(payment_status=paid)の合計。RLS適用後はappsが自動的にhonbu受付分のみに
  // 絞られるが、念のため intake_source !== "koushi" でも明示的に絞る。
  const honbuPaidApps = apps.filter((a) => a.intake_source !== "koushi" && a.payment_status === "paid");
  const paidKits = kits.filter((k) => k.payment_status === "paid");
  const revenueTotal =
    honbuPaidApps.reduce((sum, a) => sum + a.honbu_revenue, 0) + paidKits.reduce((sum, k) => sum + k.amount, 0);
  const revenueThisMonth =
    honbuPaidApps.filter((a) => a.created_at.startsWith(monthKey)).reduce((sum, a) => sum + a.honbu_revenue, 0) +
    paidKits.filter((k) => k.created_at.startsWith(monthKey)).reduce((sum, k) => sum + k.amount, 0);

  // 「community参加希望」= community_interest=trueの件数（本部受付分のみ。RLS上見える範囲がそもそもそれ）。
  const communityInterestCount = apps.filter((a) => a.intake_source !== "koushi" && a.community_interest).length;

  return (
    <div className="mx-auto max-w-5xl space-y-5 md:space-y-6">
      <div>
        <p className="text-sm text-[var(--mikke-muted)]">
          {hq.name} — こんにちは、{profile.display_name}さん
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
        <StatCard icon={BookOpen} label="講座数" value={courses.length} sub="件" detail={`公開中 ${publishedCourses}件`} />
        <StatCard icon={Users} label="認定講師" value={instructors.length} sub="名" detail={`活動中 ${activeInstructors}名`} />
        <StatCard icon={ClipboardList} label="今月の申込" value={monthApps.length} sub="件" detail={`本部${honbuIntake}・講師${koushiIntake}`} />
        <StatCard
          icon={ClipboardList}
          label="未対応の申込"
          value={pendingApps.length}
          sub="件"
          detail={pendingApps.length > 0 ? `最古の申込: ${oldestPendingDays}日前` : "対応待ちなし"}
          alert={pendingApps.length > 0}
        />
      </div>

      {/* Wave F (AC-F6) */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3">
        <StatCard icon={JapaneseYen} label="今月の売上" value={revenueThisMonth} sub="円" detail="本部受付申込＋キット発注の入金済み分" />
        <StatCard icon={JapaneseYen} label="累計売上" value={revenueTotal} sub="円" detail="本部受付申込＋キット発注の入金済み分" />
        <StatCard icon={Heart} label="community参加希望" value={communityInterestCount} sub="名" detail="本部受付分のみの集計です" />
      </div>

      {renewalAlerts.length > 0 ? (
        <section className="rounded-2xl border border-[var(--mikke-accent)]/40 bg-[var(--mikke-accent-soft)] p-4 md:p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-[var(--mikke-accent-strong)]">
              <AlertTriangle size={15} /> 更新期限が近い講師
            </h2>
            <Link href="/academy/instructors" className="flex items-center gap-1 text-xs font-bold text-[var(--mikke-accent)]">
              講師管理を見る <ArrowRight size={13} />
            </Link>
          </div>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {renewalAlerts.map(({ instructor, daysUntilDue, isOverdue }) => {
              const course = courseMap[instructor.course_id];
              return (
                <li key={instructor.id}>
                  <Link
                    href={`/academy/instructors/${instructor.id}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white bg-white/70 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--mikke-text)]">
                        {instructor.business_name || "（屋号未設定）"}
                      </p>
                      <p className="truncate text-[11px] text-[var(--mikke-muted)]">
                        {course?.code ?? ""} ・ 更新期限 {instructor.renewal_due}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isOverdue ? "bg-[var(--mikke-danger)] text-white" : "bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]"
                      }`}
                    >
                      {isOverdue ? `${Math.abs(daysUntilDue)}日超過` : `あと${daysUntilDue}日`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 最近の申込 */}
        <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--mikke-text)]">最近の申込</h2>
            <Link href="/academy/applications" className="flex items-center gap-1 text-xs font-bold text-[var(--mikke-accent)]">
              一覧を見る <ArrowRight size={13} />
            </Link>
          </div>
          {recentApps.length === 0 ? (
            <p className="mt-4 text-xs text-[var(--mikke-muted)]">まだ申込がありません。</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--mikke-surface-soft)]">
              {recentApps.map((a) => (
                <li key={a.id}>
                  <Link href={`/academy/applications/${a.id}`} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--mikke-text)]">{a.applicant_name}</p>
                      <p className="truncate text-[11px] text-[var(--mikke-muted)]">
                        {courseMap[a.course_id]?.code ?? ""} {a.intake_source === "koushi" ? "講師受付" : "本部受付"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--mikke-accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">
                      {APPLICATION_STATUS_LABELS[a.status]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 対応中のキット注文 */}
        <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--mikke-text)]">対応中のキット注文</h2>
            <Link href="/academy/applications" className="flex items-center gap-1 text-xs font-bold text-[var(--mikke-accent)]">
              一覧を見る <ArrowRight size={13} />
            </Link>
          </div>
          {pendingKits.length === 0 ? (
            <p className="mt-4 text-xs text-[var(--mikke-muted)]">対応中の注文はありません。</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--mikke-surface-soft)]">
              {pendingKits.slice(0, 5).map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--mikke-text)]">{k.title}</p>
                    <p className="text-[11px] text-[var(--mikke-muted)]">{k.amount.toLocaleString()}円</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--mikke-accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">
                    <Package size={11} /> 対応中
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default function AcademyDashboardPage() {
  return (
    <HonbuShell title="ダッシュボード">
      <DashboardContent />
    </HonbuShell>
  );
}
