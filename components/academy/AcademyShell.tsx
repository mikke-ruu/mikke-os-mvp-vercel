"use client";

import Link from "next/link";
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
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { getAcademyOnboardingEligibility, getMyAcademyHeadquartersAccess } from "@/lib/academy/trial";
import { getMyInstructorRecords } from "@/lib/academy/instructor-portal";
import { listPublicHeadquartersByIds } from "@/lib/academy/lp";
import { supabase } from "@/lib/supabase/client";
import type { AcademyAccessContext, AcademyHeadquartersAccess } from "@/types/database";

const honbuNav: MikkeShellNavItem[] = [
  { href: "/academy", label: "ダッシュボード", icon: LayoutDashboard, section: "本部" },
  { href: "/academy/courses", label: "講座管理", icon: BookOpen, section: "講座" },
  { href: "/academy/classes", label: "開催日程・担当講師", icon: CalendarCheck, section: "講座" },
  { href: "/academy/instructors", label: "講師管理", icon: Users, section: "講座" },
  { href: "/academy/applications", label: "申込管理", icon: ClipboardList, section: "講座" },
  { href: "/academy/front", label: "ホームページ編集", icon: Store, section: "公開" },
  { href: "/academy/settings", label: "本部設定", icon: Settings, section: "設定" }
];

const koushiNav: MikkeShellNavItem[] = [
  { href: "/academy/portal", label: "ホーム", icon: LayoutDashboard, section: "マイポータル" },
  { href: "/academy/portal/class-requests", label: "担当する開催日", icon: CalendarCheck, section: "マイポータル" },
  { href: "/academy/portal/study", label: "復習ページ・講師用資料", icon: GraduationCap, section: "マイポータル" },
  { href: "/academy/portal/url", label: "営業用URL", icon: Link2, section: "募集" },
  { href: "/academy/portal/applications", label: "申込管理", icon: ClipboardList, section: "募集" },
  { href: "/academy/portal/kits", label: "講座仕入れ", icon: Package, section: "発注" }
];

const honbuBottomNav: MikkeShellBottomNavItem[] = [
  { href: "/academy", label: "ホーム", icon: LayoutDashboard },
  { href: "/academy/courses", label: "講座", icon: BookOpen },
  { href: "/academy/instructors", label: "講師", icon: Users },
  { href: "/academy/applications", label: "申込", icon: ClipboardList }
];

const koushiBottomNav: MikkeShellBottomNavItem[] = [
  { href: "/academy/portal", label: "ホーム", icon: LayoutDashboard },
  { href: "/academy/portal/study", label: "復習・資料", icon: GraduationCap },
  { href: "/academy/portal/applications", label: "申込", icon: ClipboardList },
  { href: "/academy/portal/kits", label: "仕入れ", icon: Package }
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
  const routeContext = parseAcademyContextPath(pathname);
  const hasContextPathPrefix = pathname.startsWith("/academy/h/");
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
  const [previewMode, setPreviewMode] = useState<"checking" | "dashboard" | "walkthrough" | "trial" | "readonly" | "off">("checking");

  useEffect(() => {
    const requestedPreview = new URLSearchParams(window.location.search).get("preview");
    setPreviewMode(
      process.env.NODE_ENV === "development" &&
        (requestedPreview === "dashboard" || requestedPreview === "walkthrough" || requestedPreview === "trial" || requestedPreview === "readonly")
        ? requestedPreview
        : "off"
    );
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
    router.replace(previewMode === "readonly" ? `${canonicalHref}?preview=readonly` : canonicalHref);
  }, [accessLoading, hasContextPathPrefix, hasPortalAccess, pathname, previewMode, router, selectedContext, variant]);

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

  const trialLocked = headquartersAccess?.access_kind === "trial" && !headquartersAccess.can_manage_drafts;

  function captureAcademyLink(event: React.MouseEvent<HTMLDivElement>) {
    if (previewMode === "readonly" || previewMode === "dashboard" || previewMode === "walkthrough" || previewMode === "trial" || trialLocked) {
      const target = event.target as Element;
      const toggle = target.closest('input[type="checkbox"], input[type="radio"]');
      const button = target.closest("button");
      const mutationLabel = button?.textContent ?? toggle?.closest("label")?.textContent ?? "";
      if (
        toggle ||
        (button && /保存|削除|公開|非公開|解除|登録|作成|追加|更新|送信|承認|却下|発行|招待|確定|支払|完了|取消|取り消/.test(mutationLabel))
      ) {
        event.preventDefault();
        event.stopPropagation();
        window.alert(
          trialLocked
            ? "7日間お試しは終了しています。有料利用を開始するまで変更できません。自動課金はされていません。"
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
    if (previewMode !== "readonly" && previewMode !== "dashboard" && previewMode !== "walkthrough" && previewMode !== "trial" && !trialLocked) return;
    event.preventDefault();
    event.stopPropagation();
    window.alert(
      trialLocked
        ? "7日間お試しは終了しています。有料利用を開始するまで保存できません。自動課金はされていません。"
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

  if (!hasContextPathPrefix && contextCount > 1) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <div className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-6 text-center">
          <p className="text-sm font-bold text-[var(--mikke-text)]">利用するAcademyを特定できません</p>
          <p className="text-xs leading-5 text-[var(--mikke-muted)]">
            複数Academyがあるため、所属Academyと画面を選んでください。
          </p>
          <Link href="/academy/select" className="inline-flex rounded-xl border border-[var(--mikke-line)] px-4 py-2 text-xs font-bold text-[var(--mikke-text-soft)]">
            所属Academyと役割を確認する
          </Link>
        </div>
      </main>
    );
  }

  return (
    <MikkeAppShell
      appName="Academy"
      title={title}
      subtitle={variant === "honbu" ? "本部管理" : "マイポータル"}
      theme="blue"
      currentApp={{
        label: "Academy",
        href: contextHref(variant === "honbu" ? "/academy" : "/academy/portal"),
        icon: GraduationCap
      }}
      menuDescription="講座、講師、申込、教材などAcademy内の管理をまとめています。"
      menuEditItems={navItems.map((item) => ({ title: item.label, href: item.href, icon: item.icon }))}
      ownedApps={ownedApps}
      otherApps={[]}
      suggestedApps={suggestedApps}
      mikkeId={profile.handle}
      onSignOut={() => void signOut()}
      navItems={navItems}
      bottomNavItems={bottomNavItems}
      showSharedUtilities={variant === "koushi"}
      footerLabel="Academy by mikke"
    >
      <div onClickCapture={captureAcademyLink}>
      {previewMode === "dashboard" || previewMode === "walkthrough" ? (
        <div className="mb-4 rounded-xl border border-[var(--mikke-accent)]/35 bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm font-bold leading-6 text-[var(--mikke-text)]">
          ローカル確認用のサンプル表示です。本部運営者が認定講師も兼ねる例のため、本部画面とマイポータルの両方を確認できます。実データの保存や本番DBの変更は行いません。
        </div>
      ) : null}
      {headquartersAccess?.access_kind === "trial" ? (
        <div className="mb-4 rounded-xl border border-[var(--mikke-yellow)] bg-[var(--mikke-yellow)]/20 px-4 py-3 text-sm leading-6 text-[var(--mikke-text)]">
          <p className="font-bold">
            {trialLocked ? "7日間お試しは終了しました" : `7日間お試し ・ あと${headquartersAccess.days_remaining}日`}
          </p>
          <p className="mt-1 text-xs font-medium">
            {trialLocked
              ? "作成した下書きは残っています。有料利用を開始すると編集を再開できます。自動課金はされていません。"
              : "本部設定や講座の下書きを作れます。公開、実際の申込受付、講師登録、Community連携は有料利用の開始後に使えます。外部動画URLは利用できますが、Academy内の動画配信は準備中です。自動課金はされません。"}
          </p>
        </div>
      ) : null}
      {previewMode === "readonly" ? (
        <div className="mb-4 rounded-xl border border-[var(--mikke-accent)]/35 bg-[var(--mikke-accent-soft)] px-4 py-3 text-xs font-bold text-[var(--mikke-accent-strong)]">
          ローカル読み取り確認中です。画面移動はできますが、フォームの保存は停止しています。
        </div>
      ) : null}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-[var(--mikke-muted)]">
          {selectedContext ? `${selectedContext.academy_name} / ` : ""}
          {variant === "honbu" ? "本部管理" : "マイポータル"}
        </p>
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
              {variant === "honbu" ? "認定講師としてマイポータルへ" : "本部運営に戻る"}
            </Link>
          ) : null}
        </div>
      </div>
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
