"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, BookOpen, ClipboardList, GraduationCap, Heart, JapaneseYen, Package, Sparkles, Users } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { AcademyPlatformBillingLoader } from "@/app/academy/billing/AcademyPlatformBillingLoader";
import { toAcademyContextHref, toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { resolveAcademyCourseFeaturesForCourse } from "@/lib/academy/course-feature-settings";
import { supabase } from "@/lib/supabase/client";
import { getAcademyLaunchProgress } from "@/lib/academy/launch-progress";
import {
  createHeadquarters,
  getOwnedHeadquarters,
  hasAvailablePlatformHeadquartersCreation
} from "@/lib/academy/headquarters";
import { getAcademyOnboardingEligibility, startAcademySevenDayTrial } from "@/lib/academy/trial";

const ACADEMY_TRIAL_TERMS_VERSION = "academy-pilot-2026-08-30";
import { listCourses } from "@/lib/academy/courses";
import { listMaterials } from "@/lib/academy/materials";
import { getRenewalAlerts, listInstructors } from "@/lib/academy/instructors";
import {
  academyPreviewApplications,
  academyPreviewCourses,
  academyPreviewHeadquarters,
  academyPreviewInstructors,
  academyPreviewKitOrders,
  academyPreviewMaterials
} from "@/lib/academy/preview";
import { APPLICATION_STATUS_LABELS, listApplications } from "@/lib/academy/applications";
import { listKitOrders } from "@/lib/academy/kits";
import type {
  AcademyApplication,
  AcademyCourse,
  AcademyHeadquarters,
  AcademyInstructor,
  AcademyKitOrder,
  AcademyMaterial
} from "@/types/database";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  detail,
  alert,
  href
}: {
  icon: typeof BookOpen;
  label: string;
  value: number;
  sub?: string;
  detail?: string;
  alert?: boolean;
  href?: string;
}) {
  const content = (
    <>
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
      <div className="mt-1 flex items-center justify-between gap-2">
        {detail ? <p className="min-w-0 truncate text-[11px] text-[var(--mikke-muted)]">{detail}</p> : <span />}
        {href ? <span className="shrink-0 text-[10px] font-bold text-[var(--mikke-accent-strong)]">見る →</span> : null}
      </div>
    </>
  );
  const className = `block rounded-2xl border p-3.5 transition md:p-4 ${alert ? "border-[var(--mikke-accent)]/40 bg-[var(--mikke-accent-soft)]" : "border-[var(--mikke-line)] bg-white"} ${href ? "hover:border-[var(--mikke-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mikke-primary)]" : ""}`;

  return href ? (
    <Link href={toCurrentAcademyContextHref(href)} className={className} aria-label={`${label} ${value}${sub ?? ""}を見る`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function DashboardContent() {
  const router = useRouter();
  const { user, profile, isGuest } = useAuth();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [instructors, setInstructors] = useState<AcademyInstructor[]>([]);
  const [apps, setApps] = useState<AcademyApplication[]>([]);
  const [kits, setKits] = useState<AcademyKitOrder[]>([]);
  const [materials, setMaterials] = useState<AcademyMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [canStartTrial, setCanStartTrial] = useState(false);
  const [trialTermsAccepted, setTrialTermsAccepted] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState(false);
  const [launchGuideOpen, setLaunchGuideOpen] = useState(true);

  useEffect(() => {
    async function load() {
      const previewRequested =
        process.env.NODE_ENV === "development" &&
        ["dashboard", "walkthrough", "trial"].includes(new URLSearchParams(window.location.search).get("preview") ?? "");
      if (previewRequested) {
        setLocalPreview(true);
        setHq(academyPreviewHeadquarters);
        setCourses(academyPreviewCourses);
        setLaunchGuideOpen(!academyPreviewCourses.some((course) => course.is_published));
        setInstructors(academyPreviewInstructors);
        setApps(academyPreviewApplications);
        setKits(academyPreviewKitOrders);
        setMaterials(academyPreviewMaterials);
        setLoading(false);
        return;
      }
      const [foundHq, eligibility, platformCreationAvailable] = await Promise.all([
        getOwnedHeadquarters(profile.user_id),
        getAcademyOnboardingEligibility(),
        hasAvailablePlatformHeadquartersCreation()
      ]);
      setHq(foundHq);
      setCanCreate(platformCreationAvailable);
      setCanStartTrial(eligibility.trial_available);
      if (foundHq) {
        const [c, i, a, k, m] = await Promise.all([
          listCourses(foundHq.id),
          listInstructors(foundHq.id),
          listApplications(foundHq.id),
          listKitOrders(foundHq.id),
          listMaterials(foundHq.id)
        ]);
        setCourses(c);
        setLaunchGuideOpen(!c.some((course) => course.is_published));
        setInstructors(i);
        setApps(a);
        setKits(k);
        setMaterials(m);
      }
      setLoading(false);
    }
    load();
  }, [profile.user_id]);

  async function initHq() {
    setLoading(true);
    setCreationError(null);
    try {
      const created = await createHeadquarters(`${profile.display_name}アカデミー`);
      setHq(created);
      setCanCreate(false);
      router.replace(toAcademyContextHref("/academy", created.id, "manage"));
    } catch {
      setCreationError("本部を作成できませんでした。契約確認の状態を管理者へお問い合わせください。");
    } finally {
      setLoading(false);
    }
  }

  async function startTrial() {
    if (!trialTermsAccepted) {
      setCreationError("7日間お試しの条件を確認し、同意してください。");
      return;
    }
    setLoading(true);
    setCreationError(null);
    try {
      const created = await startAcademySevenDayTrial(
        `${profile.display_name}アカデミー`,
        ACADEMY_TRIAL_TERMS_VERSION
      );
      setHq(created);
      setCanStartTrial(false);
      router.replace(toAcademyContextHref("/academy", created.id, "manage"));
    } catch {
      setCreationError("7日間お試しを開始できませんでした。画面を読み込み直して、もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;

  if (!hq) {
    return (
      <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-6 text-center">
        <p className="text-sm font-bold text-[var(--mikke-text)]">
          {canStartTrial ? "7日間、無料でお試しできます" : canCreate ? "本部を作成できます" : "Academyの利用確認が必要です"}
        </p>
        <p className="text-xs leading-5 text-[var(--mikke-muted)]">
          {canStartTrial
            ? "質問に答えながら本部設定と講座の下書きを作れます。公開や実際の申込受付は行われず、自動課金もありません。"
            : canCreate
            ? "契約確認済みの作成権を使って、認定講座を管理する本部を作成します。"
            : "利用状況を確認できませんでした。すでに本部をお持ちの場合は、所属Academyの選択画面をご確認ください。"}
        </p>
        {canStartTrial ? (
          <div className="space-y-3 text-left">
            <label className="flex items-start gap-2 rounded-xl bg-[var(--mikke-surface-soft)] p-3 text-xs leading-5 text-[var(--mikke-text-soft)]">
              <input
                type="checkbox"
                checked={trialTermsAccepted}
                onChange={(event) => setTrialTermsAccepted(event.target.checked)}
                className="mt-1"
              />
              <span>
                7日間は下書き作成のお試し期間です。自動課金はなく、期限後は閲覧のみになることに同意します。
              </span>
            </label>
            <button
              onClick={startTrial}
              disabled={!trialTermsAccepted}
              className="w-full rounded-xl bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              7日間お試しを始める
            </button>
          </div>
        ) : null}
        {canCreate ? (
          <button onClick={initHq} className="w-full rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--mikke-text)]">
            契約確認済みの本部を作成する
          </button>
        ) : null}
        {!canCreate ? (
          <div className="mt-4 border-t border-[var(--mikke-line)] pt-4 text-left">
            <p className="mb-3 text-xs font-bold text-[var(--mikke-text)]">有料で新しい本部を始める場合</p>
            <AcademyPlatformBillingLoader
              userId={user.id}
              resourceId={null}
              isGuest={isGuest}
              auth={supabase.auth}
              fetch={globalThis.fetch}
              checkoutPlanKey="small"
            />
          </div>
        ) : null}
        {creationError ? <p className="text-xs font-bold text-red-600">{creationError}</p> : null}
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
  const { steps: launchSteps, next: gettingStarted } = getAcademyLaunchProgress({
    headquarters: hq,
    courses: courses.map(course => ({ ...course, needsInstructorMaterials: resolveAcademyCourseFeaturesForCourse(course).materialLicenses })),
    materialCourseIds: materials.map(material => material.course_id),
    instructorCount: instructors.length,
  });
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

      <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-3 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--mikke-text)]">Academy開講までの流れ</p>
            <p className="mt-1 hidden text-sm leading-6 text-[var(--mikke-muted)] sm:block">保存内容から、次に行う設定を案内します。</p>
          </div>
          <button
            type="button"
            aria-expanded={launchGuideOpen}
            onClick={() => setLaunchGuideOpen((open) => !open)}
            className="shrink-0 rounded-full border border-[var(--mikke-line)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--mikke-text-soft)] md:hidden"
          >
            {launchGuideOpen ? "閉じる" : "開く"}
          </button>
        </div>
        <ol className={`${launchGuideOpen ? "grid" : "hidden md:grid"} mt-3 grid-cols-2 gap-2`}>
          {launchSteps.map((item) => (
            <li key={item.step}>
              <Link href={toCurrentAcademyContextHref(item.href)} aria-current={item.isCurrent ? "step" : undefined} className={`block h-full rounded-xl border p-2.5 md:p-3 ${item.state === "complete" ? "border-[var(--mikke-success)]/35 bg-[var(--mikke-success-soft)]" : item.isCurrent ? "border-[var(--mikke-primary)] bg-[var(--mikke-accent-soft)]" : "border-[var(--mikke-line)] bg-white"}`}>
                <p className="text-xs font-bold text-[var(--mikke-text)]">STEP {item.step} ・ {item.state === "complete" ? "完了" : item.state === "unconfirmed" ? "未確認" : "未完了"}{item.isCurrent ? " ・ いまここ" : ""}</p>
                <p className="mt-1 text-sm font-bold text-[var(--mikke-text)]">{item.label}</p>
                <p className="mt-1 hidden text-[11px] leading-5 text-[var(--mikke-muted)] sm:block">{item.description}</p>
              </Link>
            </li>
          ))}
        </ol>
        <div className="mt-3 rounded-xl bg-[var(--mikke-surface-soft)] p-3 text-[11px] leading-5 text-[var(--mikke-muted)]">
          <span className="font-bold text-[var(--mikke-text)]">本部ホームページ</span>は団体全体の紹介と講座一覧、<span className="font-bold text-[var(--mikke-text)]">公開講座ページ</span>は1つの講座の説明と申込受付のためのページです。
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--mikke-accent)]/35 bg-[var(--mikke-accent-soft)] p-4 md:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[var(--mikke-accent)]">
            <Sparkles size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[var(--mikke-text)]">次にすること ・ STEP {gettingStarted.step}</p>
            <h2 className="mt-1 text-base font-bold text-[var(--mikke-text)]">{gettingStarted.label}</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">{gettingStarted.description}</p>
            <Link
              href={toCurrentAcademyContextHref(gettingStarted.href)}
              className="mt-3 inline-flex items-center gap-1 rounded-full bg-[var(--mikke-accent)] px-4 py-2 text-xs font-bold text-white"
            >
              {gettingStarted.action} <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {localPreview ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <p className="text-[11px] text-[var(--mikke-muted)]">ローカル確認用の複数パターで、講座一覧と設定画面を巡回できます。</p>
          <Link href={toCurrentAcademyContextHref("/academy/portal?preview=walkthrough&sample=learner")} className="inline-flex items-center gap-1 rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-text-soft)]">
            <GraduationCap size={14} /> マイポータルサンプルを見る
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
        <StatCard href="/academy/courses" icon={BookOpen} label="講座数" value={courses.length} sub="件" detail={`公開中 ${publishedCourses}件`} />
        <StatCard href="/academy/instructors" icon={Users} label="認定講師" value={instructors.length} sub="名" detail={`活動中 ${activeInstructors}名`} />
        <StatCard href="/academy/applications" icon={ClipboardList} label="今月の申込" value={monthApps.length} sub="件" detail={`本部${honbuIntake}・講師${koushiIntake}`} />
        <StatCard
          href="/academy/applications"
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
