"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  PenSquare,
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
  canCreateAcademyHeadquarters,
  listMyAcademyContexts,
  parseAcademyContextPath,
  toAcademyContextHref
} from "@/lib/academy/access-context";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { getMyInstructorRecords } from "@/lib/academy/instructor-portal";
import { listPublicHeadquartersByIds } from "@/lib/academy/lp";
import { supabase } from "@/lib/supabase/client";
import type { AcademyAccessContext } from "@/types/database";

const honbuNav: MikkeShellNavItem[] = [
  { href: "/academy", label: "ダッシュボード", icon: LayoutDashboard, section: "本部" },
  { href: "/academy/courses", label: "講座管理", icon: BookOpen, section: "講座" },
  { href: "/academy/classes", label: "クラス・担当講師", icon: CalendarCheck, section: "講座" },
  { href: "/academy/instructors", label: "講師管理", icon: Users, section: "講座" },
  { href: "/academy/applications", label: "申込管理", icon: ClipboardList, section: "講座" },
  { href: "/academy/front", label: "ホームページ編集", icon: Store, section: "公開" },
  { href: "/academy/instructor-pages", label: "講師ページ編集", icon: PenSquare, section: "公開" },
  { href: "/academy/settings", label: "本部設定", icon: Settings, section: "設定" }
];

const koushiNav: MikkeShellNavItem[] = [
  { href: "/academy/portal", label: "ダッシュボード", icon: LayoutDashboard, section: "講師ポータル" },
  { href: "/academy/portal/class-requests", label: "クラス担当依頼", icon: CalendarCheck, section: "講師ポータル" },
  { href: "/academy/portal/study", label: "講師ページ", icon: GraduationCap, section: "講師ポータル" },
  { href: "/academy/portal/url", label: "営業用URL", icon: Link2, section: "募集" },
  { href: "/academy/portal/applications", label: "申込管理", icon: ClipboardList, section: "募集" },
  { href: "/academy/portal/kits", label: "キット発注", icon: Package, section: "発注" }
];

const honbuBottomNav: MikkeShellBottomNavItem[] = [
  { href: "/academy", label: "ホーム", icon: LayoutDashboard },
  { href: "/academy/courses", label: "講座", icon: BookOpen },
  { href: "/academy/instructors", label: "講師", icon: Users },
  { href: "/academy/applications", label: "申込", icon: ClipboardList }
];

const koushiBottomNav: MikkeShellBottomNavItem[] = [
  { href: "/academy/portal", label: "ホーム", icon: LayoutDashboard },
  { href: "/academy/portal/study", label: "ページ", icon: GraduationCap },
  { href: "/academy/portal/applications", label: "申込", icon: ClipboardList },
  { href: "/academy/portal/kits", label: "発注", icon: Package }
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
  const [previewMode, setPreviewMode] = useState<"checking" | "dashboard" | "readonly" | "off">("checking");

  useEffect(() => {
    const requestedPreview = new URLSearchParams(window.location.search).get("preview");
    setPreviewMode(
      process.env.NODE_ENV === "development" && (requestedPreview === "dashboard" || requestedPreview === "readonly")
        ? requestedPreview
        : "off"
    );
  }, []);

  useEffect(() => {
    if (previewMode === "checking") return;
    let active = true;

    async function resolveAccess() {
      if (previewMode === "dashboard") {
        const previewContext: AcademyAccessContext = {
          academy_id: "00000000-0000-4000-8000-000000000001",
          academy_name: "ローカル確認用Academy",
          academy_handle: "local-preview",
          roles: ["owner", "instructor"],
          portals: ["manage", "teach"],
          capabilities: [
            "academy:headquarters:view",
            "academy:headquarters:manage",
            "academy:courses:manage",
            "academy:instructors:manage",
            "academy:applications:manage",
            "academy:settings:manage"
          ]
        };
        setContextCount(1);
        setSelectedContext(previewContext);
        setHasPortalAccess(true);
        setCanSwitchPortal(true);
        setAccessError(false);
        setAccessLoading(false);
        return;
      }
      try {
        setAccessError(false);
        const [contexts, creationAllowed] = await Promise.all([
          listMyAcademyContexts(),
          variant === "honbu" ? canCreateAcademyHeadquarters() : Promise.resolve(false)
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
        setContextCount(contexts.length);
        setSelectedContext(selected);
        setHasPortalAccess(
          (routeMatchesPortal && routeMatchesCapability && selected?.portals.includes(currentPortal)) ||
            (!hasContextPathPrefix && contexts.length === 0 && variant === "honbu" && creationAllowed)
        );
        setCanSwitchPortal(selected?.portals.includes(otherPortal) ?? false);
      } catch {
        if (!active) return;
        setAccessError(true);
        setHasPortalAccess(false);
        setCanSwitchPortal(false);
        setContextCount(0);
        setSelectedContext(null);
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
    if (previewMode === "dashboard" || accessLoading || hasContextPathPrefix || !selectedContext || !hasPortalAccess) return;
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
      if (previewMode === "dashboard") {
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

  function contextHref(href: string) {
    if (!selectedContext) return href;
    const contextualHref = toAcademyContextHref(
      href,
      selectedContext.academy_id,
      variant === "honbu" ? "manage" : "teach"
    );
    if (
      previewMode === "readonly" &&
      contextualHref.startsWith("/academy") &&
      !contextualHref.includes("preview=readonly")
    ) {
      return `${contextualHref}${contextualHref.includes("?") ? "&" : "?"}preview=readonly`;
    }
    return contextualHref;
  }

  function captureAcademyLink(event: React.MouseEvent<HTMLDivElement>) {
    if (previewMode === "readonly") {
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
        window.alert("ローカル確認中は変更できません。本番データは変更されていません。");
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
    if (previewMode !== "readonly") return;
    event.preventDefault();
    event.stopPropagation();
    window.alert("ローカル確認中は保存できません。本番データは変更されていません。");
  }

  const navItems = (variant === "honbu" ? honbuNav : koushiNav)
    .filter((item) => variant === "koushi" || canShowManageHref(selectedContext, item.href))
    .map((item) => ({ ...item, href: contextHref(item.href) }));
  const bottomNavItems = (variant === "honbu" ? honbuBottomNav : koushiBottomNav)
    .filter((item) => variant === "koushi" || canShowManageHref(selectedContext, item.href))
    .map((item) => ({ ...item, href: contextHref(item.href) }));
  const redirectingToCanonical = previewMode !== "dashboard" && !hasContextPathPrefix && selectedContext && hasPortalAccess;

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
            {variant === "honbu" ? "本部画面を利用できません" : "講師ポータルを利用できません"}
          </p>
          <p className="text-xs leading-5 text-[var(--mikke-muted)]">
            {variant === "honbu"
              ? "本部画面は、有効なAcademy契約または本部から付与された運営権限がある場合だけ表示されます。"
              : "講師ポータルは、登録中の講師として紐づいている場合だけ表示されます。"}
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
      subtitle={variant === "honbu" ? "本部管理" : "講師ポータル"}
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
      {previewMode === "dashboard" ? (
        <div className="mb-4 rounded-xl border border-[var(--mikke-accent)]/35 bg-[var(--mikke-accent-soft)] px-4 py-3 text-xs font-bold text-[var(--mikke-accent-strong)]">
          ローカル確認用のサンプル表示です。実データの保存や本番DBの変更は行いません。
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
          {variant === "honbu" ? "本部管理" : "講師ポータル"}
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
              href={contextHref(variant === "honbu" ? "/academy/portal" : "/academy")}
              className="inline-flex items-center gap-1 rounded-[10px] border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-text-soft)]"
            >
              {variant === "honbu" ? <GraduationCap size={14} /> : <Store size={14} />}
              {variant === "honbu" ? "講師ポータルへ" : "本部画面へ"}
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
