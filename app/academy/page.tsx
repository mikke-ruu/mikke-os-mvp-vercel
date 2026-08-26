"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, BookOpen, ClipboardList, GraduationCap, Heart, JapaneseYen, Package, Sparkles, Users } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { toAcademyContextHref, toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { resolveAcademyCourseFeaturesForCourse } from "@/lib/academy/course-feature-settings";
import { createHeadquarters, getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { getAcademyOnboardingEligibility, startAcademySevenDayTrial } from "@/lib/academy/trial";
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
  const router = useRouter();
  const { profile } = useAuth();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [instructors, setInstructors] = useState<AcademyInstructor[]>([]);
  const [apps, setApps] = useState<AcademyApplication[]>([]);
  const [kits, setKits] = useState<AcademyKitOrder[]>([]);
  const [materials, setMaterials] = useState<AcademyMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [canStartTrial, setCanStartTrial] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState(false);

  useEffect(() => {
    async function load() {
      const previewRequested =
        process.env.NODE_ENV === "development" &&
        ["dashboard", "walkthrough", "trial"].includes(new URLSearchParams(window.location.search).get("preview") ?? "");
      if (previewRequested) {
        setLocalPreview(true);
        setHq(academyPreviewHeadquarters);
        setCourses(academyPreviewCourses);
        setInstructors(academyPreviewInstructors);
        setApps(academyPreviewApplications);
        setKits(academyPreviewKitOrders);
        setMaterials(academyPreviewMaterials);
        setLoading(false);
        return;
      }
      const [foundHq, eligibility] = await Promise.all([
        getOwnedHeadquarters(profile.user_id),
        getAcademyOnboardingEligibility()
      ]);
      setHq(foundHq);
      setCanCreate(eligibility.paid_creation_available);
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
    setLoading(true);
    setCreationError(null);
    try {
      const created = await startAcademySevenDayTrial(`${profile.display_name}アカデミー`);
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
          <button onClick={startTrial} className="w-full rounded-xl bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-bold text-white">
            7日間お試しを始める
          </button>
        ) : null}
        {canCreate ? (
          <button onClick={initHq} className="w-full rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--mikke-text)]">
            契約確認済みの本部を作成する
          </button>
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
  const firstCourse = courses[0];
  const firstPublishedCourse = courses.find((course) => course.is_published);
  const courseNeedingMaterial = courses.find((course) => {
    const features = resolveAcademyCourseFeaturesForCourse(course);
    return course.is_published && features.materialLicenses && !materials.some((material) => material.course_id === course.id);
  });
  const gettingStarted = courses.length === 0
    ? {
        position: "STEP 2",
        question: "講座を作りましょう",
        description: "6つの質問に答えると、講座の下書きができます。この時点では公開されません。",
        href: "/academy/courses/new",
        action: "講座の質問へ進む"
      }
    : publishedCourses === 0
      ? {
          position: "STEP 3",
          question: "講座の詳細を設定しましょう",
          description: `「${firstCourse.name}」の料金、教材、開催日、申込方法を項目ごとに確認します。`,
          href: `/academy/courses/${firstCourse.id}`,
          action: "講座の詳細設定へ進む"
        }
      : courseNeedingMaterial
        ? {
            position: "STEP 3",
            question: "講座の教材を登録しましょう",
            description: `「${courseNeedingMaterial.name}」の認定講師に共有するPDF・動画・外部URLを登録します。`,
            href: `/academy/materials/new?course=${encodeURIComponent(courseNeedingMaterial.id)}`,
            action: "講師用ファイルを登録"
          }
        : instructors.length === 0
          ? {
              position: "STEP 5",
              question: "講師を登録しましょう",
              description: "本部オーナー自身が教える場合、既存講師を移行する場合、受講者から認定講師になる場合から選べます。",
              href: "/academy/instructors",
              action: "講師の登録方法を選ぶ"
            }
        : {
            position: "STEP 6",
            question: "公開前の最終確認をしましょう",
            description: "公開講座ページを、受講希望者と同じ見え方で確認します。",
            href: `/academy/c/${firstPublishedCourse!.id}`,
            action: "公開講座ページを確認"
          };
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
  const launchSteps = [
    { step: 1, label: "本部を設定", description: "団体名、連絡先、ロゴなど", href: "/academy/settings", state: "complete" },
    { step: 2, label: "講座を作成", description: "6つの質問から下書きを作成", href: "/academy/courses/new", state: courses.length > 0 ? "complete" : "current" },
    { step: 3, label: "講座の詳細を設定", description: "申込、料金、開催日、教材、認定", href: firstCourse ? `/academy/courses/${firstCourse.id}` : "/academy/courses", state: courses.length > 0 ? "current" : "pending" },
    { step: 4, label: "本部ホームページを作成", description: "団体全体の紹介と講座一覧", href: "/academy/front", state: "pending" },
    { step: 5, label: "講師を登録", description: "自分、既存講師、修了した受講者から登録", href: "/academy/instructors", state: instructors.length > 0 ? "complete" : "pending" },
    { step: 6, label: "公開前に確認", description: "公開講座ページを確認", href: firstPublishedCourse ? `/academy/c/${firstPublishedCourse.id}` : "/academy/courses", state: "pending" }
  ] as const;

  return (
    <div className="mx-auto max-w-5xl space-y-5 md:space-y-6">
      <div>
        <p className="text-sm text-[var(--mikke-muted)]">
          {hq.name} — こんにちは、{profile.display_name}さん
        </p>
      </div>

      <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-5">
        <div>
          <p className="text-sm font-bold text-[var(--mikke-text)]">Academy開講までの流れ</p>
          <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">今どこを設定しているか、次に何をするかを確認できます。</p>
        </div>
        <ol className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {launchSteps.map((item) => (
            <li key={item.step}>
              <Link href={toCurrentAcademyContextHref(item.href)} className={`block h-full rounded-xl border p-3 ${item.state === "complete" ? "border-[var(--mikke-success)]/35 bg-[var(--mikke-success-soft)]" : item.state === "current" ? "border-[#3f4eb5] bg-[var(--mikke-accent-soft)]" : "border-[var(--mikke-line)] bg-white"}`}>
                <p className="text-[10px] font-bold text-[var(--mikke-accent-strong)]">STEP {item.step}{item.state === "complete" ? " ・ 完了" : item.state === "current" ? " ・ いまここ" : ""}</p>
                <p className="mt-1 text-sm font-bold text-[var(--mikke-text)]">{item.label}</p>
                <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">{item.description}</p>
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
            <p className="text-[11px] font-bold text-[var(--mikke-accent-strong)]">次にすること ・ {gettingStarted.position}</p>
            <h2 className="mt-1 text-base font-bold text-[var(--mikke-text)]">{gettingStarted.question}</h2>
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
