"use client";

import { useAcademy2Headquarters } from '@/components/academy2/HeadquartersBoundary';
import { HeadquartersHome } from '@/components/academy2/HeadquartersHome';

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { AcademyStudioHome } from "@/components/academy/AcademyStudioHome";
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
import { getNoOperatingFeeOnboardingAvailable } from "@/lib/academy/trial";

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
  const pathname = usePathname();
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
  const [canStartNoFee, setCanStartNoFee] = useState(false);
  const preparationInFlight = useRef(false);
  const activeIdentity = useRef(true);
  useEffect(() => {
    activeIdentity.current = true;
    return () => { activeIdentity.current = false; };
  }, []);
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
        getNoOperatingFeeOnboardingAvailable(),
        hasAvailablePlatformHeadquartersCreation()
      ]);
      setHq(foundHq);
      setCanCreate(platformCreationAvailable);
      setCanStartNoFee(eligibility);
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
  }, [profile.user_id, pathname]);

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

  async function startNoFee() {
    if (preparationInFlight.current) return;
    preparationInFlight.current = true;
    setLoading(true);
    setCreationError(null);
    try {
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      if (!activeIdentity.current || sessionError || session.session?.user.id !== user.id) throw new Error("preparation_identity_changed");
      const { data: created, error } = await supabase.rpc("academy2_create_no_operating_fee_headquarters" as never, {
        p_name: `${profile.display_name}アカデミー`.slice(0, 100)
      } as never);
      if (error) throw error;
      const { data: currentSession, error: currentSessionError } = await supabase.auth.getSession();
      if (!activeIdentity.current || currentSessionError || currentSession.session?.user.id !== user.id) throw new Error("preparation_identity_changed");
      if (!created || (created as { scheme?: string }).scheme !== "no_operating_fee" || typeof (created as { headquarters_id: string }).headquarters_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((created as { headquarters_id: string }).headquarters_id)) throw new Error("invalid_preparation");
      setCanStartNoFee(false);
      router.replace(toAcademyContextHref((created as {academy2_enabled?:boolean}).academy2_enabled ? "/academy/settings?onboarding=1" : "/academy", (created as { headquarters_id: string }).headquarters_id, "manage"));
    } catch {
      setCreationError("本部の準備状態を確認できませんでした。画面を再読み込みしてご確認ください。この操作では運営利用料の契約や請求は発生しません。");
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
          {canStartNoFee ? "まずは本部と講座の下書きを準備しましょう" : canCreate ? "本部を作成できます" : "Academyの利用確認が必要です"}
        </p>
        <p className="text-xs leading-5 text-[var(--mikke-muted)]">
          {canStartNoFee
            ? "Academy運営利用料は当面請求しません。講座・教材・募集・開催を継続して利用できます。初回公開から7日後の有料移行や月額請求はありません。"
            : canCreate
            ? "契約確認済みの作成権を使って、認定講座を管理する本部を作成します。"
            : "利用状況を確認できませんでした。すでに本部をお持ちの場合は、所属Academyの選択画面をご確認ください。"}
        </p>
        {canStartNoFee ? (
          <div className="space-y-3 text-left">
            <p className="rounded-xl bg-[var(--mikke-surface-soft)] p-3 text-xs leading-5">このボタンでは講座は公開されず、課金も始まりません。</p>
            <button
              onClick={startNoFee}
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
        {!canCreate && !canStartNoFee ? (
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

  return <><AcademyStudioHome name={hq.name} courses={courses} pendingCount={apps.filter(a => a.status === "received").length} guideScope={`${profile.user_id}:${hq.id}`} /></>;
}

export default function AcademyDashboardPage() {
  return (
    <HonbuShell title="ホーム">
      <DashboardIdentity />
    </HonbuShell>
  );
}

function DashboardIdentity() {
  const hq = useAcademy2Headquarters();
  const { user } = useAuth();
  const pathname = usePathname();
  if (hq) return <HeadquartersHome key={hq.id} />;
  return <DashboardContent key={`${user.id}:${pathname}`} />;
}
