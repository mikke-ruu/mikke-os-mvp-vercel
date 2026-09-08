"use client";

import Link from "next/link";
import { AcademyPageHelp } from "./AcademyPageHelp";
import { AcademyUsageStatus } from "./AcademyUsageStatus";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  ExternalLink,
  GraduationCap,
  LayoutDashboard,
  Link2,
  Package,
  Settings,
  Store,
  Users
} from "lucide-react";
import { AuthGate, useAuth } from "@/components/AuthGate";
import {
  MikkeAppShell,
  type MikkeShellBottomNavItem,
  type MikkeShellNavItem
} from "@/components/mikkeos/MikkeAppShell";
import { useOwnedMikkeApps } from "@/components/mikkeos/useOwnedMikkeApps";
import {
  listMyAcademyContexts,
  parseAcademyContextPath,
  toAcademyContextHref
} from "@/lib/academy/access-context";
import { withAcademyContextQuery } from "@/lib/academy/context-query.mjs";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { getAcademyOnboardingEligibility, getMyAcademyHeadquartersAccess } from "@/lib/academy/trial";
import { getAcademyAccessNotice } from "@/lib/academy/access-notice";
import { getMyInstructorRecords } from "@/lib/academy/instructor-portal";
import { listPublicHeadquartersByIds } from "@/lib/academy/lp";
import { supabase } from "@/lib/supabase/client";
import type { AcademyAccessContext, AcademyHeadquartersAccess } from "@/types/database";

const honbuNav: MikkeShellNavItem[] = [
  { href: "/academy", label: "ホーム", icon: LayoutDashboard, section: "はじめる" },
  { href: "/academy/courses", label: "講座をつくる・編集する", icon: BookOpen, section: "講座づくり" },
  { href: "/academy/classes", label: "開催日程・担当講師", icon: CalendarCheck, section: "講座" },
  { href: "/academy/instructors", label: "講師管理", icon: Users, section: "講座" },
  { href: "/academy/applications", label: "申込・受注管理", icon: ClipboardList, section: "運営" },
  { href: "/academy/front", label: "ホームページ編集", icon: Store, section: "公開" },
  { href: "/academy/settings", label: "本部設定", icon: Settings, section: "設定" }
];

const koushiNav: MikkeShellNavItem[] = [
  { href: "/academy/portal", label: "ホーム", icon: LayoutDashboard, section: "マイポータル" },
  { href: "/academy/portal/class-requests", label: "担当する開催日", icon: CalendarCheck, section: "マイポータル" },
  { href: "/academy/portal/study", label: "復習ページ・講師用資料", icon: GraduationCap, section: "マイポータル" },
  { href: "/academy/portal/url", label: "募集ページ・共有リンク", icon: Link2, section: "募集" },
  { href: "/academy/portal/applications", label: "申込管理", icon: ClipboardList, section: "募集" },
  { href: "/academy/portal/kits", label: "教材の注文・履歴", icon: Package, section: "発注" }
];

const honbuBottomNav: MikkeShellBottomNavItem[] = [
  { href: "/academy", label: "ホーム", icon: LayoutDashboard },
  { href: "/academy/courses", label: "講座", icon: BookOpen },
  { href: "/academy/instructors", label: "講師", icon: Users },
  { href: "/academy/applications", label: "申込・受注", icon: ClipboardList }
];

const koushiBottomNav: MikkeShellBottomNavItem[] = [
  { href: "/academy/portal", label: "ホーム", icon: LayoutDashboard },
  { href: "/academy/portal/study", label: "復習・資料", icon: GraduationCap },
  { href: "/academy/portal/applications", label: "申込", icon: ClipboardList },
  { href: "/academy/portal/kits", label: "教材注文", icon: Package }
];

function canShowManageHref(context: AcademyAccessContext | null, href: string) {
  if (!context) return true;
  if (href === "/academy") return context.capabilities.includes("academy:headquarters:view");
  if (href.startsWith("/academy/classes")) {
    return context.capabilities.includes("academy:headquarters:manage");
  }
  if (href.startsWith("/academy/courses")) {
    return context.capabilities.includes("academy:courses:manage");
  }
  if (href.startsWith("/academy/instructors")) {
    return context.capabilities.includes("academy:instructors:manage");
  }
  if (href.startsWith("/academy/applications")) {
    return context.capabilities.includes("academy:applications:manage");
  }
  return context.capabilities.includes("academy:settings:manage");
}

function canShowPersonalHref(context: AcademyAccessContext | null, href: string, personalView: "learner" | "instructor") {
  if (!context) return true;
  if (href === "/academy/portal" || href.startsWith("/academy/portal/study")) {
    return context.capabilities.includes("academy:learner_portal:view") ||
      context.capabilities.includes("academy:instructor_portal:view");
  }
  if (personalView === "learner") return false;
  return context.capabilities.includes("academy:instructor:operate");
}

function manageHrefForCapabilityCheck(pathname: string) {
  const canonical = pathname.match(/^\/academy\/h\/[0-9a-f-]{36}\/manage(\/.*)?$/i);
  return canonical ? `/academy${canonical[1] ?? ""}` : pathname;
}

function ShellInner({
  variant,
  title,
  children
}: {
  variant: "honbu" | "koushi";
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canonicalSearch = searchParams.toString();
  const routeContext = parseAcademyContextPath(pathname);
  const hasContextPathPrefix = pathname.startsWith("/academy/h/");
  const workingOnCourse = variant === "honbu" && /\/courses\/[^/]+/.test(pathname);
  const settingsPage = pathname.endsWith("/settings");
  const { profile, user } = useAuth();
  const { ownedApps, suggestedApps } = useOwnedMikkeApps({ userId: user.id });
  const [homepageHref, setHomepageHref] = useState<string | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessError, setAccessError] = useState(false);
  const [hasPortalAccess, setHasPortalAccess] = useState(false);
  const [canSwitchPortal, setCanSwitchPortal] = useState(false);
  const [contextCount, setContextCount] = useState(0);
  const [selectedContext, setSelectedContext] = useState<AcademyAccessContext | null>(null);
  const [headquartersAccess, setHeadquartersAccess] = useState<AcademyHeadquartersAccess | null>(null);
  const [accessBannerDismissed, setAccessBannerDismissed] = useState(false);
  const [previewMode, setPreviewMode] = useState<"checking" | "dashboard" | "walkthrough" | "trial" | "readonly" | "off">("checking");

  useEffect(() => {
    const requestedPreview = new URLSearchParams(window.location.search).get("preview");
    setPreviewMode(
      process.env.NODE_ENV === "development" &&
        (requestedPreview === "dashboard" || requestedPreview === "walkthrough" || requestedPreview === "trial" || requestedPreview === "readonly")
        ? requestedPreview
        : "off"
    );
    setAccessBannerDismissed(window.sessionStorage.getItem("academy-access-banner-dismissed") === "1");
  }, []);

  useEffect(() => {
    if (previewMode === "checking") return;
    let active = true;

    async function resolveAccess() {
      if (previewMode === "dashboard" || previewMode === "walkthrough" || previewMode === "trial") {
        const previewContext: AcademyAccessContext = {
          academy_id: "00000000-0000-4000-8000-000000000001",
          academy_name: "ローカル確認用Academy",
          academy_handle: "local-preview",
          roles: ["owner", "instructor", "learner"],
          portals: ["manage", "teach"],
          capabilities: [
            "academy:headquarters:view",
            "academy:headquarters:manage",
            "academy:courses:manage",
            "academy:instructors:manage",
            "academy:applications:manage",
            "academy:settings:manage",
            "academy:learner_portal:view",
            "academy:instructor_portal:view",
            "academy:instructor_materials:view",
            "academy:instructor:operate"
          ]
        };
        setContextCount(1);
        setSelectedContext(previewContext);
        setHeadquartersAccess(
          previewMode === "trial"
            ? await getMyAcademyHeadquartersAccess(previewContext.academy_id)
            : null
        );
        setHasPortalAccess(true);
        setCanSwitchPortal(true);
        setAccessError(false);
        setAccessLoading(false);
        return;
      }
      try {
        setAccessError(false);
        const [contexts, onboarding] = await Promise.all([
          listMyAcademyContexts(),
          variant === "honbu"
            ? getAcademyOnboardingEligibility()
            : Promise.resolve({ trial_available: false, paid_creation_available: false, trial_block_reason: null })
        ]);
        if (!active) return;
        const currentPortal = variant === "honbu" ? "manage" : "teach";
        const otherPortal = variant === "honbu" ? "teach" : "manage";
        const selected = routeContext
          ? contexts.find((context) => context.academy_id === routeContext.academyId) ?? null
          : !hasContextPathPrefix && contexts.length === 1
            ? contexts[0]
            : null;
        const routeMatchesPortal = !routeContext || routeContext.portal === currentPortal;
        const routeMatchesCapability =
          variant === "koushi" || canShowManageHref(selected, manageHrefForCapabilityCheck(pathname));
        const access = selected
          ? await getMyAcademyHeadquartersAccess(selected.academy_id)
          : null;
        setContextCount(contexts.length);
        setSelectedContext(selected);
        setHeadquartersAccess(access);
        setHasPortalAccess(
          (routeMatchesPortal && routeMatchesCapability && selected?.portals.includes(currentPortal)) ||
            (!hasContextPathPrefix && contexts.length === 0 && variant === "honbu" &&
              (onboarding.trial_available || onboarding.paid_creation_available))
        );
        setCanSwitchPortal(selected?.portals.includes(otherPortal) ?? false);
      } catch {
        if (!active) return;
        setAccessError(true);
        setHasPortalAccess(false);
        setCanSwitchPortal(false);
        setContextCount(0);
        setSelectedContext(null);
        setHeadquartersAccess(null);
      } finally {
        if (active) setAccessLoading(false);
      }
    }

    void resolveAccess();
    return () => {
      active = false;
    };
  }, [hasContextPathPrefix, pathname, previewMode, routeContext?.academyId, routeContext?.portal, user.id, variant]);

  useEffect(() => {
    if (
      previewMode === "dashboard" ||
      previewMode === "walkthrough" ||
      previewMode === "trial" ||
      accessLoading ||
      hasContextPathPrefix ||
      !selectedContext ||
      !hasPortalAccess
    ) return;
    const canonicalHref = toAcademyContextHref(
      pathname,
      selectedContext.academy_id,
      variant === "honbu" ? "manage" : "teach"
    );
    router.replace(withAcademyContextQuery(canonicalHref, canonicalSearch, {
      readonlyPreview: previewMode === "readonly"
    }));
  }, [accessLoading, canonicalSearch, hasContextPathPrefix, hasPortalAccess, pathname, previewMode, router, selectedContext, variant]);

  useEffect(() => {
    let active = true;

    async function resolveHomepage() {
      if (previewMode === "dashboard" || previewMode === "walkthrough" || previewMode === "trial") {
        setHomepageHref(null);
        return;
      }
      try {
        if (variant === "honbu") {
          const headquarters = await getOwnedHeadquarters(user.id, selectedContext?.academy_id);
          if (active) {
            setHomepageHref(headquarters?.is_active ? `/academy/site/${encodeURIComponent(headquarters.handle)}` : null);
          }
          return;
        }

        const instructorRecords = await getMyInstructorRecords(user.id, selectedContext?.academy_id);
        const headquartersIds = [...new Set(instructorRecords.map((record) => record.headquarters_id))];
        const headquarters = await listPublicHeadquartersByIds(headquartersIds);
        // 複数本部に所属する講師は、共通ヘッダーから本部を一意に決められないため表示しない。
        if (active) {
          setHomepageHref(
            headquarters.length === 1 ? `/academy/site/${encodeURIComponent(headquarters[0].handle)}` : null
          );
        }
      } catch {
        if (active) setHomepageHref(null);
      }
    }

    void resolveHomepage();
    return () => {
      active = false;
    };
  }, [previewMode, selectedContext?.academy_id, user.id, variant]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }

  function contextHref(href: string, portalOverride?: "manage" | "teach") {
    if (!selectedContext) return href;
    const contextualHref = toAcademyContextHref(
      href,
      selectedContext.academy_id,
      portalOverride ?? (variant === "honbu" ? "manage" : "teach")
    );
    if (
      (previewMode === "readonly" || previewMode === "dashboard" || previewMode === "walkthrough" || previewMode === "trial") &&
      contextualHref.startsWith("/academy") &&
      !contextualHref.includes("preview=")
    ) {
      const preview = previewMode === "dashboard" ? "walkthrough" : previewMode;
      return `${contextualHref}${contextualHref.includes("?") ? "&" : "?"}preview=${preview}`;
    }
    return contextualHref;
  }

  const accessNotice = getAcademyAccessNotice(headquartersAccess);
  const accessLocked = accessNotice !== null;
  const trialLocked = headquartersAccess?.access_kind === "trial" && accessLocked;

  function dismissAccessBanner() {
    window.sessionStorage.setItem("academy-access-banner-dismissed", "1");
    setAccessBannerDismissed(true);
  }

  function captureAcademyLink(event: React.MouseEvent<HTMLDivElement>) {
    if (previewMode === "readonly" || previewMode === "dashboard" || previewMode === "walkthrough" || previewMode === "trial" || accessLocked) {
      const target = event.target as Element;
      const toggle = target.closest('input[type="checkbox"], input[type="radio"]');
      const button = target.closest("button");
      const mutationLabel = button?.textContent ?? toggle?.closest("label")?.textContent ?? "";
      // Only this local-only panel handles its own in-memory changes; API write guards remain intact.
      const localPublication = process.env.NODE_ENV === "development" && !accessLocked &&
        (previewMode === "walkthrough" || previewMode === "dashboard" || previewMode === "trial") &&
        !!target.closest('#course-publication[data-academy-local-publication="true"]');
      if (
        !localPublication && (toggle ||
        (button && /保存|削除|公開|非公開|解除|登録|作成|追加|更新|送信|承認|却下|発行|招待|確定|支払|完了|取消|取り消/.test(mutationLabel)))
      ) {
        event.preventDefault();
        event.stopPropagation();
        window.alert(
          accessLocked
            ? accessNotice.mutationMessage
            : "ローカル確認中は変更できません。本番データは変更されていません。"
        );
        return;
      }
    }
    if (!selectedContext || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element).closest("a");
    const href = anchor?.getAttribute("href");
    if (!href || anchor?.getAttribute("target") === "_blank") return;
    const contextualHref = contextHref(href);
    if (contextualHref === href) return;
    event.preventDefault();
    router.push(contextualHref);
  }

  function blockReadonlySubmit(event: React.FormEvent<HTMLDivElement>) {
    if (previewMode !== "readonly" && previewMode !== "dashboard" && previewMode !== "walkthrough" && previewMode !== "trial" && !accessLocked) return;
    event.preventDefault();
    event.stopPropagation();
    window.alert(
      accessLocked
        ? accessNotice.mutationMessage
        : "ローカル確認中は保存できません。本番データは変更されていません。"
    );
  }

  const requestedPersonalView = searchParams.get("view") ?? searchParams.get("sample");
  const canUseLearnerView = selectedContext?.capabilities.includes("academy:learner_portal:view") ?? false;
  const canUseInstructorView = selectedContext?.capabilities.includes("academy:instructor_portal:view") ?? false;
  const personalView: "learner" | "instructor" =
    requestedPersonalView === "instructor" && canUseInstructorView
      ? "instructor"
      : canUseLearnerView
        ? "learner"
        : "instructor";
  const trialManageHrefs = new Set(
    trialLocked
      ? ["/academy"]
      : ["/academy", "/academy/courses", "/academy/front", "/academy/settings"]
  );
  const navItems = (variant === "honbu" ? honbuNav : koushiNav)
    .filter((item) => variant !== "honbu" || headquartersAccess?.access_kind !== "trial" || trialManageHrefs.has(item.href))
    .filter((item) => variant === "honbu" ? canShowManageHref(selectedContext, item.href) : canShowPersonalHref(selectedContext, item.href, personalView))
    .map((item) => ({
      ...item,
      label: variant === "koushi" && item.href.startsWith("/academy/portal/study")
        ? personalView === "learner" ? "復習ページ" : "講師用資料"
        : item.label,
      href: contextHref(
        variant === "koushi" && (item.href === "/academy/portal" || item.href.startsWith("/academy/portal/study"))
          ? `${item.href}?view=${personalView}`
          : item.href
      )
    }));
  const bottomNavItems = (variant === "honbu" ? honbuBottomNav : koushiBottomNav)
    .filter((item) => variant !== "honbu" || headquartersAccess?.access_kind !== "trial" || trialManageHrefs.has(item.href))
    .filter((item) => variant === "honbu" ? canShowManageHref(selectedContext, item.href) : canShowPersonalHref(selectedContext, item.href, personalView))
    .map((item) => ({
      ...item,
      label: variant === "koushi" && item.href.startsWith("/academy/portal/study")
        ? personalView === "learner" ? "復習" : "講師資料"
        : item.label,
      href: contextHref(
        variant === "koushi" && (item.href === "/academy/portal" || item.href.startsWith("/academy/portal/study"))
          ? `${item.href}?view=${personalView}`
          : item.href
      )
    }));
  const redirectingToCanonical =
    previewMode !== "dashboard" &&
    previewMode !== "walkthrough" &&
    previewMode !== "trial" &&
    !hasContextPathPrefix &&
    selectedContext &&
    hasPortalAccess;

  if (profile.user_id !== user.id || accessLoading || redirectingToCanonical) {
    return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">権限を確認中…</p>;
  }

  if (accessError) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <div className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-6 text-center">
          <p className="text-sm font-bold text-[var(--mikke-text)]">Academyの権限を確認できませんでした</p>
          <p className="text-xs leading-5 text-[var(--mikke-muted)]">
            通信状態を確認して、画面を読み込み直してください。本部作成やAcademy選択は行われていません。
          </p>
          <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-[var(--mikke-accent)] px-4 py-2 text-xs font-bold text-white">
            もう一度読み込む
          </button>
        </div>
      </main>
    );
  }

  if (!hasContextPathPrefix && contextCount > 1) {
    return <main className="mx-auto max-w-lg px-5 py-12"><div className="rounded-3xl border border-[var(--mikke-line)] bg-white p-6"><GraduationCap className="mb-4 text-[#3f4eb5]" size={32} /><h1 className="text-2xl font-bold">どのAcademyを開きますか？</h1><p className="mt-3 text-sm leading-7 text-[var(--mikke-muted)]">複数のAcademyに所属しています。講座をつくるAcademyを選んでください。</p><Link href="/academy/select" className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-[#f75a3b] px-5 py-3 text-sm font-bold text-white">Academyを選ぶ</Link></div></main>;
  }

  if (!hasPortalAccess) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <div className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-6 text-center">
          <p className="text-sm font-bold text-[var(--mikke-text)]">
            {variant === "honbu" ? "本部画面を利用できません" : "このAcademyのマイポータルを利用できません"}
          </p>
          <p className="text-xs leading-5 text-[var(--mikke-muted)]">
            {variant === "honbu"
              ? "本部画面は、有効なAcademy契約または本部から付与された運営権限がある場合だけ表示されます。"
              : "受講者または認定講師として登録されている場合だけ表示されます。講師用の申込・開催・発注機能は、活動中の認定講師だけが利用できます。"}
          </p>
          <Link href="/academy/select" className="inline-flex rounded-xl border border-[var(--mikke-line)] px-4 py-2 text-xs font-bold text-[var(--mikke-text-soft)]">
            利用できるAcademyを確認する
          </Link>
        </div>
      </main>
    );
  }

  return (
    <MikkeAppShell
      appName="Academy"
      title={title}
      subtitle={variant === "honbu" ? "本部｜教室全体の運営" : "マイポータル｜自分の受講・講師活動"}
      theme="blue"
      currentApp={{
        label: "Academy",
        href: contextHref(variant === "honbu" ? "/academy" : "/academy/portal"),
        icon: GraduationCap
      }}
      menuDescription={variant === "honbu" ? "講座をつくり、教室全体の申込・日程・講師を管理します。" : "自分の受講内容や、講師として担当する講座を確認します。"}
      menuEditItems={navItems.map((item) => ({ title: item.label, href: item.href, icon: item.icon }))}
      ownedApps={ownedApps}
      otherApps={[]}
      suggestedApps={suggestedApps}
      mikkeId={profile.handle}
      onSignOut={() => void signOut()}
      navItems={navItems}
      bottomNavItems={bottomNavItems}
      showBottomNavLabels
      showSharedUtilities={variant === "koushi"}
      footerLabel="Academy by mikke"
    >
      <div
        onClickCapture={captureAcademyLink}
        className="min-w-0 overflow-x-hidden [&_input]:max-w-full [&_input]:text-base [&_select]:max-w-full [&_select]:text-base [&_textarea]:max-w-full [&_textarea]:text-base sm:[&_input]:text-sm sm:[&_select]:text-sm sm:[&_textarea]:text-sm"
      >
      {previewMode === "dashboard" || previewMode === "walkthrough" ? (
        <div className="mb-2 border-l-2 border-[var(--mikke-accent)] px-2 py-1 text-xs leading-5 text-[var(--mikke-text)]">
          操作確認用のサンプルです。実データは変更しません。
        </div>
      ) : null}
      {variant === "honbu" && selectedContext ? <AcademyUsageStatus access={headquartersAccess} sample={previewMode === "walkthrough" || previewMode === "dashboard" || previewMode === "trial"} href={contextHref("/academy/settings")} /> : null}
      {variant !== "honbu" && headquartersAccess?.access_kind === "trial" && !accessBannerDismissed ? (
        <div className="relative mb-4 rounded-xl border border-[var(--mikke-yellow)] bg-[var(--mikke-yellow)]/20 text-[var(--mikke-text)]">
          <button
            type="button"
            aria-label="Academy利用状態のお知らせを閉じる"
            onClick={dismissAccessBanner}
            className="absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-full text-lg font-bold text-[var(--mikke-muted)] hover:bg-white/70"
          >
            ×
          </button>
          <Link href={contextHref("/academy/settings")} className="block px-4 py-3 pr-12">
            <p className="text-sm font-bold">
              {trialLocked ? "7日間お試しは終了しました" : `7日間お試し ・ あと${headquartersAccess.days_remaining}日`}
            </p>
            <p className="mt-0.5 text-xs font-medium">
              自動課金はされません。詳細を見る →
            </p>
          </Link>
        </div>
      ) : null}
      {headquartersAccess?.access_kind === "paid" && accessNotice && !accessBannerDismissed ? (
        <div className="mb-4 rounded-xl border border-[var(--mikke-yellow)] bg-[var(--mikke-yellow)]/20 px-4 py-3 text-sm leading-6 text-[var(--mikke-text)]">
          <p className="font-bold">{accessNotice.title}</p>
          <p className="mt-1 text-xs font-medium">{accessNotice.description}</p>
          <Link href={contextHref("/academy/settings")} className="mt-2 inline-flex rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-text)]">
            Academy利用料金を確認する
          </Link>
        </div>
      ) : null}
      {variant !== "honbu" && settingsPage && headquartersAccess?.access_kind === "paid" && !accessNotice && !accessBannerDismissed ? (
        <div className="mb-4 rounded-xl border border-[var(--mikke-green)] bg-[var(--mikke-green)]/15 px-4 py-3 text-sm leading-6 text-[var(--mikke-text)]">
          <p className="font-bold">
            {headquartersAccess.status === "internal_grant"
              ? "Academyを利用できます"
              : "Academy有料プランを利用中です"}
          </p>
          <p className="mt-1 text-xs font-medium">
            {headquartersAccess.status === "internal_grant"
              ? "この本部は現在利用できます。料金のお申し込み状況は、本部設定の「Academy利用料金」で確認できます。"
              : "現在の利用状況と次回の請求内容は、本部設定の「Academy利用料金」で確認できます。"}
          </p>
          <Link href={contextHref("/academy/settings")} className="mt-2 inline-flex rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-text)]">
            Academy利用料金を確認する
          </Link>
        </div>
      ) : null}
      {previewMode === "readonly" ? (
        <div className="mb-4 rounded-xl border border-[var(--mikke-accent)]/35 bg-[var(--mikke-accent-soft)] px-4 py-3 text-xs font-bold text-[var(--mikke-accent-strong)]">
          ローカル読み取り確認中です。画面移動はできますが、フォームの保存は停止しています。
        </div>
      ) : null}
      <div className={`mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--mikke-line)] bg-white pb-2 ${workingOnCourse ? "hidden" : ""}`}>
        <div className="min-w-0"><p className="break-words text-xs font-bold text-[var(--mikke-muted)]">
          {selectedContext ? `${selectedContext.academy_name} / ` : ""}
          {variant === "honbu" ? "本部" : "マイポータル"}
        </p></div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {homepageHref ? (
            <Link
              href={homepageHref}
              target="_blank"
              className="inline-flex items-center gap-1 rounded-[10px] border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-text-soft)]"
            >
              <ExternalLink size={14} />
              ホームページを見る
            </Link>
          ) : null}
          {canSwitchPortal ? (
            <Link
              href={contextHref(
                variant === "honbu" ? "/academy/portal" : "/academy",
                variant === "honbu" ? "teach" : "manage"
              )}
              className="inline-flex items-center gap-1 rounded-[10px] border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-text-soft)]"
            >
              {variant === "honbu" ? <GraduationCap size={14} /> : <Store size={14} />}
              {variant === "honbu" ? "自分の受講・講師活動へ →" : "教室全体の運営へ →"}
            </Link>
          ) : null}
        </div>
      </div>
      {variant === "honbu" ? <AcademyPageHelp pathname={pathname} /> : null}
      <div onSubmitCapture={blockReadonlySubmit}>{children}</div>
      </div>
    </MikkeAppShell>
  );
}

export function HonbuShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <AuthGate>
      <ShellInner variant="honbu" title={title}>
        {children}
      </ShellInner>
    </AuthGate>
  );
}

export function KoushiShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <AuthGate>
      <ShellInner variant="koushi" title={title}>
        {children}
      </ShellInner>
    </AuthGate>
  );
}
