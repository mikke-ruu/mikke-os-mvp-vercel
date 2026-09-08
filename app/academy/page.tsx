"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { AcademyOperationsDashboard } from "@/components/academy/AcademyOperationsDashboard";
import { listAcademyClasses } from "@/lib/academy/classes";
import type { AcademyClass } from "@/types/database";
import { AcademyPlatformBillingLoader } from "@/app/academy/billing/AcademyPlatformBillingLoader";
import { toAcademyContextHref } from "@/lib/academy/access-context";
import { supabase } from "@/lib/supabase/client";
import {
  createHeadquarters,
  getOwnedHeadquarters,
  hasAvailablePlatformHeadquartersCreation
} from "@/lib/academy/headquarters";
import { getAcademyOnboardingEligibility } from "@/lib/academy/trial";

const ACADEMY_PREPARATION_POLICY = "academy-first-publication-trial-2026-09-08-v1";
import { listCourses } from "@/lib/academy/courses";
import { listInstructors } from "@/lib/academy/instructors";
import {
  academyPreviewApplications,
  academyPreviewClasses,
  academyPreviewCourses,
  academyPreviewHeadquarters,
  academyPreviewInstructors,
  academyPreviewKitOrders
} from "@/lib/academy/preview";
import { listApplications } from "@/lib/academy/applications";
import { listKitOrders } from "@/lib/academy/kits";
import type {
  AcademyApplication,
  AcademyCourse,
  AcademyHeadquarters,
  AcademyInstructor,
  AcademyKitOrder
} from "@/types/database";

function DashboardContent() {
  const router = useRouter();
  const { user, profile, isGuest } = useAuth();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [instructors, setInstructors] = useState<AcademyInstructor[]>([]);
  const [apps, setApps] = useState<AcademyApplication[]>([]);
  const [kits, setKits] = useState<AcademyKitOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [classesError, setClassesError] = useState(false);
  const [classes, setClasses] = useState<AcademyClass[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [canStartTrial, setCanStartTrial] = useState(false);
  const preparationInFlight = useRef(false);
  const [creationError, setCreationError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(false);
      setClassesError(false);
      try {
      const previewRequested =
        process.env.NODE_ENV === "development" &&
        ["dashboard", "walkthrough", "trial"].includes(new URLSearchParams(window.location.search).get("preview") ?? "");
      if (previewRequested) {
        setClasses(academyPreviewClasses);
        setHq(academyPreviewHeadquarters);
        setCourses(academyPreviewCourses);
        setInstructors(academyPreviewInstructors);
        setApps(academyPreviewApplications);
        setKits(academyPreviewKitOrders);
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
        try { setClasses(await listAcademyClasses(foundHq.id)); } catch { setClassesError(true); }
      }
      } catch { setLoadError(true); } finally { setLoading(false); }
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
    if (preparationInFlight.current) return;
    preparationInFlight.current = true;
    setLoading(true);
    setCreationError(null);
    try {
      const { data: created, error } = await supabase.rpc("academy_first_publication_create_preparation", {
        p_name: `${profile.display_name}アカデミー`.slice(0, 100),
        p_policy_version: ACADEMY_PREPARATION_POLICY
      });
      if (error) throw error;
      if (!created || created.scheme !== "first_publication_168h_v1" || typeof created.headquarters_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(created.headquarters_id)) throw new Error("invalid_preparation");
      setCanStartTrial(false);
      router.replace(toAcademyContextHref("/academy", created.headquarters_id, "manage"));
    } catch {
      setCreationError("本部の準備状態を確認できませんでした。画面を再読み込みしてご確認ください。この操作では無料期間や課金は始まりません。");
    } finally {
      setLoading(false);
      preparationInFlight.current = false;
    }
  }

  if (loadError) return <div role="alert" className="border p-5"><h2 className="font-bold">ダッシュボードを読み込めませんでした</h2><p className="mt-2 text-sm">取得できない情報を0件・0円として表示していません。</p><button type="button" onClick={() => window.location.reload()} className="mt-3 min-h-11 border px-4">再読み込み</button></div>;
  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;

  if (!hq) {
    return (
      <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-6 text-center">
        <p className="text-sm font-bold text-[var(--mikke-text)]">
          {canStartTrial ? "まずは本部と講座の下書きを準備しましょう" : canCreate ? "本部を作成できます" : "Academyの利用確認が必要です"}
        </p>
        <p className="text-xs leading-5 text-[var(--mikke-muted)]">
          {canStartTrial
            ? "準備中は無料期間を消費しません。料金と支払方法を確認し、最初の講座を公開した日時から7日間無料です。その後は有料契約へ移行します。公開前に条件をご確認いただけます。"
            : canCreate
            ? "契約確認済みの作成権を使って、認定講座を管理する本部を作成します。"
            : "利用状況を確認できませんでした。すでに本部をお持ちの場合は、所属Academyの選択画面をご確認ください。"}
        </p>
        {canStartTrial ? (
          <div className="space-y-3 text-left">
            <p className="rounded-xl bg-[var(--mikke-surface-soft)] p-3 text-xs leading-5">このボタンでは講座は公開されず、課金も始まりません。</p>
            <button
              onClick={startTrial}
              className="w-full rounded-xl bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              本部を作って準備を始める
            </button>
          </div>
        ) : null}
        {canCreate ? (
          <button onClick={initHq} className="w-full rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--mikke-text)]">
            契約確認済みの本部を作成する
          </button>
        ) : null}
        {!canCreate && !canStartTrial ? (
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

  return <AcademyOperationsDashboard name={hq.name} scope={`${profile.user_id}:${hq.id}`} data={{ courses, apps, kits, instructors, classes }} classesError={classesError} />;
}

export default function AcademyDashboardPage() {
  return (
    <HonbuShell title="ホーム">
      <DashboardIdentity />
    </HonbuShell>
  );
}

function DashboardIdentity() {
  const { user } = useAuth();
  return <DashboardContent key={user.id} />;
}
