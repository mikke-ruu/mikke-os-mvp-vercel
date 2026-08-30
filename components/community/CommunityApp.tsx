"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bookmark,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CircleChevronRight,
  CreditCard,
  DoorOpen,
  FileDown,
  Flame,
  Home,
  KeyRound,
  Library,
  Lock,
  MessageCircle,
  MessagesSquare,
  Pencil,
  Paperclip,
  Plus,
  Reply,
  Search,
  Send,
  Smile,
  Settings,
  ShieldCheck,
  Sticker,
  Trash2,
  UserRound,
  Users,
  X
} from "lucide-react";
import { MikkeAppShell, type MikkeShellBottomNavItem, type MikkeShellNavItem } from "@/components/mikkeos/MikkeAppShell";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { useOwnedMikkeApps } from "@/components/mikkeos/useOwnedMikkeApps";
import {
  communityErrorMessage,
  archiveCommunityRoom,
  claimCommunityOwnership,
  createCommunityEvent,
  createCommunityChatMessage,
  createCommunityRoom,
  createCommunityComment,
  createCommunityAttachmentDownloadUrl,
  createCommunityResource,
  createCommunityDataRequest,
  createCommunityMembershipPlan,
  createCommunityPaymentClaim,
  createEntitlementDefinition,
  createCommunityPost,
  createCommunityStamp,
  deleteCommunityComment,
  deleteCommunityChatMessage,
  deleteCommunityPost,
  grantMemberEntitlement,
  inviteCommunityMemberByMikkeId,
  leaveCommunity,
  loadCommunityDashboard,
  loadCommunityChatMessages,
  loadCommunityPublicEntry,
  markCommunityRoomSeen,
  revokeMemberEntitlement,
  reorderCommunityRooms,
  restoreCommunityRoom,
  reviewCommunityPaymentClaim,
  saveCommunitySettings,
  saveCommunityProfile,
  saveCommunityOperatorProfile,
  setCommunityStampActive,
  setEventAttendance,
  moderateCommunityChatMessage,
  toggleCommunityChatReaction,
  toggleCommunityCommentReaction,
  toggleCommunityPostReaction,
  toggleCommunityPostBookmark,
  updateCommunityEvent,
  updateCommunityEventStatus,
  updateCommunityMembership,
  updateCommunityComment,
  updateCommunityChatMessage,
  updateCommunityPost,
  updateCommunityPostVisibility,
  updateCommunityResource,
  updateCommunityResourceVisibility,
  updateCommunityRoom,
  updateCommunityRoomAccess,
  uploadCommunityPostAttachment,
  searchCommunity
} from "@/lib/community/client";
import { submitCommunityJoinApplication } from "@/lib/community/client";
import { CommunityHelpView, CommunityRulesView, OwnerCommunityModerationView, OwnerCommunitySafetyView } from "@/components/community/CommunitySafetyViews";
import type { CommunityActivity, CommunityChatMessage, CommunityConversationMode, CommunityDashboard, CommunityEntitlementSource, CommunityEvent, CommunityHomeMetric, CommunityMemberEntitlement, CommunityPost, CommunityPublicEntry, CommunityResource, CommunityResourceKind, CommunityRoom, CommunityRoomAccessType, CommunityRoomColor, CommunityRoomKind, CommunitySearchResult } from "@/lib/community/types";
import { supabase } from "@/lib/supabase/client";
import { syncMikkeMediaUsages, uploadMikkeMediaImage } from "@/lib/media/client";
import { ensureProfile } from "@/lib/profile";
import { COMMUNITY_PLATFORM_PLANS, getCommunityPlatformPlan } from "@/lib/community/platform-plans";

type CommunityView = "home" | "join" | "rooms" | "room" | "post" | "compose" | "events" | "library" | "profile" | "search" | "bookmarks" | "rules" | "help" | "owner" | "owner-settings" | "owner-billing" | "owner-rooms" | "owner-members" | "owner-content" | "owner-safety" | "owner-moderation";

type SessionUser = {
  id: string;
  email?: string;
};

function entitlementSourceLabel(source: CommunityEntitlementSource) {
  if (source === "academy_subscription") return "Academy連携";
  if (source === "subscription") return "Community有料会員";
  if (source === "manual") return "運営付与";
  return "招待・外部連携";
}

function isEffectiveEntitlement(item: CommunityMemberEntitlement) {
  const now = Date.now();
  return item.status === "active"
    && Date.parse(item.startsAt) <= now
    && (item.endsAt === null || Date.parse(item.endsAt) > now);
}

const COMMUNITY_CHAT_REACTIONS = ["👍", "❤️", "😂", "🎉", "👏", "🙏"] as const;
const COMMUNITY_AVATAR_COLORS: Array<{ value: CommunityRoomColor; label: string }> = [
  { value: "blue", label: "ブルー" },
  { value: "orange", label: "オレンジ" },
  { value: "yellow", label: "イエロー" },
  { value: "pink", label: "ピンク" },
  { value: "green", label: "グリーン" }
];

function buildNavigation(base: string, showOwner: boolean) {
  const navItems: MikkeShellNavItem[] = [
    { label: "HOME", href: base, icon: Home },
    { label: "ROOMS", href: `${base}/rooms`, icon: MessagesSquare, section: "参加する" },
    { label: "EVENTS", href: `${base}/events`, icon: CalendarDays, section: "参加する" },
    { label: "LIBRARY", href: `${base}/library`, icon: Library, section: "見る・残す" },
    { label: "MY PAGE", href: `${base}/profile`, icon: UserRound, section: "見る・残す" },
    { label: "RULES", href: `${base}/rules`, icon: ShieldCheck, section: "安心して使う" },
    { label: "HELP", href: `${base}/help`, icon: MessageCircle, section: "安心して使う" }
  ];
  if (showOwner) navItems.push({ label: "OWNER", href: `${base}/owner`, icon: ShieldCheck, section: "運営" });
  const bottomNavItems: MikkeShellBottomNavItem[] = [
    { label: "HOME", href: base, icon: Home },
    { label: "ROOMS", href: `${base}/rooms`, icon: MessagesSquare },
    { label: "POST", href: `${base}/post`, icon: Plus, primary: true },
    { label: "EVENTS", href: `${base}/events`, icon: CalendarDays },
    { label: "MY PAGE", href: `${base}/profile`, icon: UserRound }
  ];
  return { navItems, bottomNavItems };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function isOwnerLike(data: CommunityDashboard | null, userId?: string) {
  return data?.community.ownerUserId === userId || data?.membership?.role === "owner" || data?.membership?.role === "moderator";
}

export function CommunityApp({ view, roomId, postId, communitySlug }: { view: CommunityView; roomId?: string; postId?: string; communitySlug: string }) {
  const router = useRouter();
  const base = `/community/c/${encodeURIComponent(communitySlug)}`;
  const [user, setUser] = useState<SessionUser | null>(null);
  const [data, setData] = useState<CommunityDashboard | null>(null);
  const [publicEntry, setPublicEntry] = useState<CommunityPublicEntry | null>(null);
  const [mikkeId, setMikkeId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const reload = async (targetUser = user) => {
    if (!targetUser) return;
    setError("");
    try {
      setData(await loadCommunityDashboard(supabase, targetUser.id, communitySlug));
    } catch (nextError) {
      setError(communityErrorMessage(nextError, "COMMUNITYを読み込めませんでした。"));
    }
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!mounted) return;
      const sessionUser = sessionData.session?.user ?? null;
      const nextUser = sessionUser ? { id: sessionUser.id, email: sessionUser.email } : null;
      setUser(nextUser);
      if (!sessionUser || !nextUser) {
        try {
          setPublicEntry(await loadCommunityPublicEntry(supabase, communitySlug));
        } catch (nextError) {
          setError(communityErrorMessage(nextError, "このCommunityの参加案内を読み込めませんでした。"));
        } finally {
          if (mounted) setLoading(false);
        }
        return;
      }
      void ensureProfile(sessionUser)
        .then((profile) => {
          if (mounted) setMikkeId(profile.handle);
        })
        .catch(() => {
          if (mounted) setMikkeId(undefined);
        });
      try {
        await reload(nextUser);
      } finally {
        if (mounted) setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [communitySlug, router]);

  useEffect(() => {
    if (!user || !data?.community.id || data.membership?.status !== "active") return;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void reload(user), 250);
    };
    const channel = supabase
      .channel(`community-dashboard-${data.community.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts", filter: `community_id=eq.${data.community.id}` }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_comments" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_chat_messages", filter: `community_id=eq.${data.community.id}` }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_post_reactions", filter: `community_id=eq.${data.community.id}` }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_comment_reactions", filter: `community_id=eq.${data.community.id}` }, scheduleReload)
      .subscribe();
    const refreshOnFocus = () => scheduleReload();
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") scheduleReload(); };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      void supabase.removeChannel(channel);
    };
  }, [data?.community.id, data?.membership?.status, user?.id]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace(`${base}/login`);
  }

  async function handleJoin(input: { displayName: string; legalName: string; phone: string; joinReason: string; acceptTerms: boolean; acceptRules: boolean; acceptPrivacy: boolean }) {
    if (!user || !data?.community) return;
    setMessage("");
    setError("");
    try {
      const application = await submitCommunityJoinApplication(supabase, data.community.id, input);
      await reload(user);
      if (application.status === "approved") {
        setMessage("COMMUNITYに参加しました。");
        router.replace(base);
      } else {
        setMessage("参加申請を受け付けました。運営者の承認をお待ちください。");
      }
    } catch (nextError) {
      setError(communityErrorMessage(nextError, "参加処理に失敗しました。"));
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-white px-5 text-[var(--mikke-text)]">
        <p className="text-sm font-semibold text-[var(--mikke-muted)]">COMMUNITYを読み込んでいます...</p>
      </main>
    );
  }

  if (!user && publicEntry) {
    return <PublicCommunityEntry community={publicEntry} base={base} />;
  }

  if (error && !data) {
    return (
      <CommunityShell base={base} userId={user?.id} mikkeId={mikkeId} onSignOut={signOut} showOwner={false}>
        <MikkeEmptyState title="COMMUNITYの準備が必要です" helper={error} />
      </CommunityShell>
    );
  }

  if (!data || !user) return null;

  const active = data.membership?.status === "active";
  const ownerLike = isOwnerLike(data, user.id);

  if (!active || view === "join") {
    return (
      <CommunityShell base={base} userId={user.id} community={data} mikkeId={mikkeId} onSignOut={signOut} showOwner={false}>
        <JoinPanel community={data} email={user.email ?? ""} defaultName={data.profile?.displayName ?? user.email?.split("@")[0] ?? ""} error={error} onJoin={handleJoin} />
      </CommunityShell>
    );
  }

  return (
    <CommunityShell base={base} userId={user.id} community={data} mikkeId={mikkeId} onSignOut={signOut} showOwner={ownerLike}>
      {message ? <Notice>{message}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}
      {view === "home" ? <HomeView base={base} data={data} userId={user.id} onReload={() => reload(user)} onMessage={setMessage} onError={setError} /> : null}
      {view === "rooms" ? <RoomsView base={base} data={data} /> : null}
      {view === "room" ? <RoomView data={data} userId={user.id} roomId={roomId} onReload={() => reload(user)} onMessage={setMessage} onError={setError} /> : null}
      {view === "post" ? <PostThreadView base={base} data={data} userId={user.id} roomId={roomId} postId={postId} onReload={() => reload(user)} onMessage={setMessage} onError={setError} /> : null}
      {view === "compose" ? <ComposeView base={base} data={data} userId={user.id} onReload={() => reload(user)} onMessage={setMessage} onError={setError} /> : null}
      {view === "events" ? <EventsView events={data.events} userId={user.id} onReload={() => reload(user)} onMessage={setMessage} onError={setError} /> : null}
      {view === "library" ? <LibraryView data={data} /> : null}
      {view === "profile" ? <ProfileView data={data} userId={user.id} onReload={() => reload(user)} onMessage={setMessage} onError={setError} /> : null}
      {view === "search" ? <CommunitySearchView base={base} data={data} /> : null}
      {view === "bookmarks" ? <BookmarksView base={base} data={data} /> : null}
      {view === "rules" ? <CommunityRulesView data={data} /> : null}
      {view === "help" ? <CommunityHelpView data={data} userId={user.id} onReload={() => reload(user)} onMessage={setMessage} onError={setError} /> : null}
      {view === "owner" ? <OwnerView base={base} data={data} ownerLike={ownerLike} /> : null}
      {view === "owner-settings" ? <OwnerSettingsView data={data} userId={user.id} ownerLike={ownerLike} onReload={() => reload(user)} onMessage={setMessage} onError={setError} /> : null}
      {view === "owner-billing" ? <OwnerBillingView data={data} ownerLike={ownerLike} /> : null}
      {view === "owner-rooms" ? <OwnerRoomsView data={data} userId={user.id} ownerLike={ownerLike} onReload={() => reload(user)} onMessage={setMessage} onError={setError} /> : null}
      {view === "owner-members" ? <OwnerMembersView data={data} userId={user.id} ownerLike={ownerLike} onReload={() => reload(user)} onMessage={setMessage} onError={setError} /> : null}
      {view === "owner-content" ? <OwnerContentView data={data} userId={user.id} ownerLike={ownerLike} onReload={() => reload(user)} onMessage={setMessage} onError={setError} /> : null}
      {view === "owner-safety" ? <OwnerCommunitySafetyView data={data} userId={user.id} ownerLike={ownerLike} onReload={() => reload(user)} onMessage={setMessage} onError={setError} /> : null}
      {view === "owner-moderation" ? <OwnerCommunityModerationView data={data} userId={user.id} ownerLike={ownerLike} onReload={() => reload(user)} onMessage={setMessage} onError={setError} /> : null}
    </CommunityShell>
  );
}

function PublicCommunityEntry({ community, base }: { community: CommunityPublicEntry; base: string }) {
  const loginHref = `${base}/login`;
  const signupHref = `${loginHref}?mode=signup`;
  const joinLabel = community.joinMode === "open_free"
    ? "無料で参加できます"
    : community.joinMode === "invite_only"
      ? "招待を受けた方が参加できます"
      : "参加条件を確認してお進みください";

  return (
    <main className="min-h-screen bg-white px-5 py-10 text-[var(--mikke-text)]">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase text-[var(--mikke-primary)]">Community by mikke</p>
        <section className="mt-5 rounded-lg border border-[var(--mikke-line)] bg-white p-6 md:p-8">
          {community.bannerUrl ? <img src={community.bannerUrl} alt="" className="mb-6 h-36 w-full rounded-xl object-cover sm:h-48" /> : null}
          {community.logoUrl ? <img src={community.logoUrl} alt="" className="mb-4 h-16 w-16 rounded-xl border border-[var(--mikke-line-soft)] object-cover" /> : null}
          <p className="text-sm font-bold text-[var(--mikke-accent-strong)]">{joinLabel}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-normal text-[var(--mikke-primary)] md:text-4xl">{community.name}に参加</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--mikke-muted)]">{community.description ?? "このCommunityから届くお知らせや交流、イベント、資料を確認できます。"}</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Link href={signupHref} className="rounded-lg bg-[var(--mikke-accent)] px-5 py-3 text-center text-sm font-bold text-white">新規登録して参加</Link>
            <Link href={loginHref} className="rounded-lg border border-[var(--mikke-line)] px-5 py-3 text-center text-sm font-bold text-[var(--mikke-primary)]">ログインして参加</Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function CommunityShell({ children, base, community, userId, mikkeId, onSignOut, showOwner }: { children: React.ReactNode; base: string; community?: CommunityDashboard | null; userId?: string; mikkeId?: string; onSignOut: () => void; showOwner: boolean }) {
  const { navItems, bottomNavItems } = buildNavigation(base, showOwner);
  const { ownedApps, suggestedApps } = useOwnedMikkeApps({ userId });
  return (
    <MikkeAppShell
      appName="COMMUNITY"
      title={community?.community.name ?? "COMMUNITY"}
      subtitle={community?.community.description ?? "無料エリアと限定エリアを運営できるCommunityアプリ"}
      currentApp={{ label: "COMMUNITY", href: base, icon: Users }}
      theme="yellow"
      navItems={navItems}
      bottomNavItems={bottomNavItems}
      ownedApps={ownedApps}
      otherApps={[]}
      suggestedApps={suggestedApps}
      mikkeId={mikkeId}
      onSignOut={onSignOut}
      footerLabel="Community by mikke"
    >
      {community?.community.bannerUrl || community?.community.logoUrl ? (
        <div className="mb-6 overflow-hidden rounded-xl border border-[var(--mikke-line)] bg-white">
          {community.community.bannerUrl ? <img src={community.community.bannerUrl} alt="" className="h-32 w-full object-cover sm:h-44" /> : null}
          {community.community.logoUrl ? <div className="flex items-center gap-3 px-4 py-3"><img src={community.community.logoUrl} alt="" className="h-12 w-12 rounded-xl border border-[var(--mikke-line-soft)] bg-white object-cover" /><p className="font-bold text-[var(--mikke-primary)]">{community.community.name}</p></div> : null}
        </div>
      ) : null}
      {children}
    </MikkeAppShell>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm font-bold text-[var(--mikke-accent-strong)]">{children}</p>;
}

function JoinPanel({ community, email, defaultName, error, onJoin }: { community: CommunityDashboard; email: string; defaultName: string; error: string; onJoin: (input: { displayName: string; legalName: string; phone: string; joinReason: string; acceptTerms: boolean; acceptRules: boolean; acceptPrivacy: boolean }) => Promise<void> }) {
  const [displayName, setDisplayName] = useState(defaultName);
  const [legalName, setLegalName] = useState("");
  const [phone, setPhone] = useState("");
  const [joinReason, setJoinReason] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptRules, setAcceptRules] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [saving, setSaving] = useState(false);
  const invited = community.invitations.some((invitation) => invitation.status === "pending");
  const canSelfJoin = community.community.joinMode === "open_free" || invited;
  const safety = community.safetySettings;
  const pending = community.myJoinApplication?.status === "pending";
  const joinModeCopy = community.community.joinMode === "invite_only"
    ? invited
      ? { badge: "招待済み", title: "招待を確認しました", helper: "必要事項と規約への同意を入力すると参加できます。" }
      : { badge: "招待制", title: "このCommunityは招待制です", helper: "運営者からmikke IDへの招待を受けてからお進みください。" }
    : community.community.joinMode === "paid"
      ? { badge: "有料申込制", title: "このCommunityは有料エリア準備中です", helper: "決済接続後、申込済みメンバーに参加導線を開放します。" }
      : { badge: "無料参加", title: `${community.community.name} に参加`, helper: community.community.description ?? "無料登録すると、このCommunityの無料Roomへ参加できます。" };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSelfJoin || pending) return;
    setSaving(true);
    await onJoin({ displayName, legalName, phone, joinReason, acceptTerms, acceptRules, acceptPrivacy });
    setSaving(false);
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="border-t border-[var(--mikke-line)] pt-6">
        <MikkeStatusBadge tone={canSelfJoin ? "primary" : "muted"}>{joinModeCopy.badge}</MikkeStatusBadge>
        <h1 className="mt-4 text-3xl font-bold tracking-normal text-[var(--mikke-primary)]">{joinModeCopy.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--mikke-muted)]">
          {joinModeCopy.helper}
        </p>
      </div>
      <form onSubmit={submit} className="rounded-lg border border-[var(--mikke-line)] bg-white p-5">
        {pending ? <div className="rounded-lg bg-[var(--mikke-yellow-soft)] p-4"><p className="font-bold text-[var(--mikke-primary)]">参加申請を確認中です</p><p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">運営者の承認後にRoomへ入れます。</p></div> : null}
        <label className="mb-4 block">
          <span className="text-sm font-bold text-[var(--mikke-text)]">メールアドレス</span>
          <input
            type="email"
            value={email}
            readOnly
            aria-readonly="true"
            className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-4 py-3 text-[var(--mikke-muted)]"
          />
          <span className="mt-1 block text-xs text-[var(--mikke-muted)]">ログイン中のmikke IDに登録されたメールアドレスです。</span>
        </label>
        <label className="block">
          <span className="text-sm font-bold text-[var(--mikke-text)]">Community内の表示名</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-4 py-3 outline-none focus:border-[var(--mikke-accent)]"
          />
        </label>
        {safety?.requireLegalName ? <label className="mt-4 block"><span className="text-sm font-bold">運営確認用のお名前</span><input value={legalName} onChange={(event) => setLegalName(event.target.value)} required className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-4 py-3" /><span className="mt-1 block text-xs text-[var(--mikke-muted)]">一般参加者には公開されません。</span></label> : null}
        {safety?.requirePhone ? <label className="mt-4 block"><span className="text-sm font-bold">電話番号</span><input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-4 py-3" /><span className="mt-1 block text-xs text-[var(--mikke-muted)]">本人確認・重要連絡・トラブル対応にのみ使用します。</span></label> : null}
        {safety?.requireJoinReason ? <label className="mt-4 block"><span className="text-sm font-bold">参加目的</span><textarea value={joinReason} onChange={(event) => setJoinReason(event.target.value)} required rows={3} className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-4 py-3" /></label> : null}
        {safety ? <div className="mt-5 space-y-3 border-t border-[var(--mikke-line-soft)] pt-4">
          <ConsentCheck checked={acceptTerms} onChange={setAcceptTerms} label={`Community利用規約（第${safety.termsVersion}版）に同意します`} text={safety.termsText} />
          <ConsentCheck checked={acceptRules} onChange={setAcceptRules} label={`Communityルール（第${safety.rulesVersion}版）に同意します`} text={safety.rulesText} />
          <ConsentCheck checked={acceptPrivacy} onChange={setAcceptPrivacy} label={`個人情報の取扱い（第${safety.privacyVersion}版）に同意します`} text={safety.privacyText} />
        </div> : null}
        {error ? <p className="mt-3 text-sm font-bold text-[var(--mikke-danger)]">{error}</p> : null}
        <button disabled={saving || !canSelfJoin || pending || Boolean(safety && !(acceptTerms && acceptRules && acceptPrivacy))} className="mt-4 w-full rounded-lg bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
          {saving ? "申請中..." : pending ? "承認待ち" : canSelfJoin ? safety?.approvalMode === "manual" ? "参加を申請する" : "同意して参加する" : "現在は参加受付外です"}
        </button>
      </form>
    </section>
  );
}

function ConsentCheck({ checked, onChange, label, text }: { checked: boolean; onChange: (value: boolean) => void; label: string; text: string }) {
  return <div className="rounded-lg border border-[var(--mikke-line-soft)] p-3"><label className="flex items-start gap-2 text-sm font-bold"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1" />{label}</label><details className="mt-2"><summary className="cursor-pointer text-xs font-bold text-[var(--mikke-primary)]">内容を確認</summary><p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-[var(--mikke-muted)]">{text}</p></details></div>;
}

function HomeView({ base, data, userId, onReload, onMessage, onError }: ViewMutationProps & { base: string }) {
  const [selectedProfile, setSelectedProfile] = useState<CommunityDashboard["profiles"][number] | null>(null);
  const visiblePosts = data.posts.filter((post) => !post.isHidden);
  const now = Date.now();
  const visibleEvents = data.events.filter((event) => event.status !== "cancelled" && new Date(event.endsAt ?? event.startsAt).getTime() >= now);
  const visibleResources = data.resources.filter((resource) => resource.isPublished);
  const pinned = visiblePosts.find((post) => post.isPinned);
  const recent = data.activities.slice(0, 7);
  const roomsById = new Map(data.rooms.map((room) => [room.id, room]));
  const unreadCount = data.rooms.reduce((total, room) => total + room.unreadCount, 0);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const activeTodayRoomIds = new Set(data.activities.filter((activity) => new Date(activity.createdAt).getTime() >= todayStart.getTime()).map((activity) => activity.roomId));
  const todayActivityCount = data.activities.filter((activity) => new Date(activity.createdAt).getTime() >= todayStart.getTime()).length;
  const trendingRooms = data.rooms
    .filter((room) => !room.isArchived && !room.isLocked && room.postCount + room.commentCount + room.messageCount > 0)
    .sort((left, right) => (right.unreadCount * 3 + right.postCount + right.commentCount + right.messageCount) - (left.unreadCount * 3 + left.postCount + left.commentCount + left.messageCount))
    .slice(0, 3);
  const attentionRoom = data.rooms.find((room) => room.unreadCount > 0 && !room.isLocked && !room.isArchived) ?? trendingRooms[0];
  const newMembers = [...data.profiles].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()).slice(0, 5);
  const visibleRooms = data.rooms.filter((room) => !room.isArchived && !room.isLocked);
  const metricCards: Record<CommunityHomeMetric, { icon: React.ReactNode; label: string; value: string; helper: string; color: string }> = {
    unread: { icon: <Bell size={16} />, label: "未読", value: `${unreadCount}件`, helper: unreadCount > 0 ? "新着あり" : "確認済み", color: "var(--mikke-orange)" },
    today_activity: { icon: <Flame size={16} />, label: "今日", value: `${todayActivityCount}件`, helper: `${activeTodayRoomIds.size} Room`, color: "var(--mikke-pink)" },
    upcoming_events: { icon: <CalendarDays size={16} />, label: "開催予定", value: `${visibleEvents.length}件`, helper: "これからの予定", color: "var(--mikke-green)" },
    rooms: { icon: <MessagesSquare size={16} />, label: "Room", value: `${visibleRooms.length}室`, helper: "参加できるRoom", color: "var(--mikke-blue)" },
    posts: { icon: <MessageCircle size={16} />, label: "投稿", value: `${visibleRooms.reduce((sum, room) => sum + room.postCount, 0)}件`, helper: "スレッド投稿", color: "var(--mikke-orange)" },
    comments: { icon: <Reply size={16} />, label: "コメント", value: `${visibleRooms.reduce((sum, room) => sum + room.commentCount, 0)}件`, helper: "会話への返信", color: "var(--mikke-pink)" },
    chat_messages: { icon: <Send size={16} />, label: "チャット", value: `${visibleRooms.reduce((sum, room) => sum + room.messageCount, 0)}件`, helper: "メッセージ", color: "var(--mikke-blue)" },
    resources: { icon: <Library size={16} />, label: "資料", value: `${visibleResources.length}件`, helper: "公開中の資料", color: "var(--mikke-green)" }
  };

  async function updateAttendance(event: CommunityEvent) {
    try {
      const nextStatus = event.attendeeStatus === "going" ? "cancelled" : "going";
      await setEventAttendance(supabase, event.id, userId, nextStatus);
      onMessage(nextStatus === "going" ? "参加予定にしました。" : "参加予定を取り消しました。");
      await onReload();
    } catch (nextError) {
      onError(communityErrorMessage(nextError, "参加予定を更新できませんでした。"));
    }
  }

  return (
    <div className="space-y-6 overflow-hidden">
      <section className="relative overflow-hidden rounded-3xl border border-[var(--mikke-line-soft)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--mikke-yellow)_58%,white),color-mix(in_srgb,var(--mikke-pink)_42%,white))] px-5 py-6 sm:px-7 sm:py-8">
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--mikke-primary)]">TODAY&apos;S COMMUNITY</p>
            <h2 className="mt-2 text-2xl font-bold tracking-normal text-[var(--mikke-primary)] sm:text-3xl">おかえりなさい、{data.profile?.displayName ?? "member"}さん</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--mikke-text-soft)]">今日の動きや気になるRoomを、ここからのぞいてみましょう。</p>
          </div>
          {attentionRoom ? <Link href={`${base}/rooms/${attentionRoom.id}`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--mikke-primary)] px-5 py-3 text-sm font-bold text-white shadow-sm">{attentionRoom.unreadCount > 0 ? `${attentionRoom.unreadCount}件の未読を見る` : `${attentionRoom.title}を見る`}<ArrowRight size={16} /></Link> : <Link href={`${base}/rooms`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--mikke-primary)] px-5 py-3 text-sm font-bold text-white"><DoorOpen size={16} />Roomを見る</Link>}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:max-w-md">
        <Link href={`${base}/search`} className="flex items-center justify-center gap-2 rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-xs font-bold text-[var(--mikke-primary)]"><Search size={15} />Community内を検索</Link>
        <Link href={`${base}/bookmarks`} className="flex items-center justify-center gap-2 rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-xs font-bold text-[var(--mikke-primary)]"><Bookmark size={15} />保存した投稿</Link>
      </section>

      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        {data.community.homeMetrics.map((metric) => <HomeSummaryCard key={metric} {...metricCards[metric]} />)}
      </section>

      {pinned ? (
        <Link href={`${base}/rooms/${pinned.roomId}/posts/${pinned.id}`} className="group flex min-w-0 items-center gap-4 rounded-2xl border border-[color-mix(in_srgb,var(--mikke-orange)_45%,var(--mikke-line))] bg-[color-mix(in_srgb,var(--mikke-orange)_10%,white)] px-4 py-4 sm:px-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--mikke-orange)] text-white"><Bell size={20} /></span>
          <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-[var(--mikke-accent-strong)]">運営からのお知らせ</span><span className="mt-1 block truncate font-bold">{pinned.title}</span></span>
          <CircleChevronRight className="shrink-0 text-[var(--mikke-primary)] transition-transform group-hover:translate-x-0.5" size={22} />
        </Link>
      ) : null}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <section>
            <div className="flex items-end justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mikke-muted-light)]">PICK UP ROOM</p><h2 className="mt-1 text-xl font-bold tracking-normal">注目Room</h2></div>
              <Link href={`${base}/rooms`} className="shrink-0 text-xs font-bold text-[var(--mikke-primary)]">すべて見る →</Link>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {trendingRooms.map((room) => <HomeRoomCard key={room.id} room={room} profiles={data.profiles} href={`${base}/rooms/${room.id}`} />)}
              {trendingRooms.length === 0 ? <div className="md:col-span-3"><MikkeEmptyState title="これから会話が始まります" helper="Roomをのぞいて、最初の話題を投稿してみましょう。" /></div> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mikke-muted-light)]">RECENT ACTIVITY</p><h2 className="mt-1 text-xl font-bold tracking-normal">最新の動き</h2></div><MessageCircle className="text-[var(--mikke-primary)]" size={24} /></div>
            <div className="mt-3 divide-y divide-[var(--mikke-line-soft)]">
              {recent.length > 0 ? recent.map((activity) => <ActivityListItem key={`${activity.kind}-${activity.id}`} activity={activity} room={roomsById.get(activity.roomId)} href={activity.postId ? `${base}/rooms/${activity.roomId}/posts/${activity.postId}` : `${base}/rooms/${activity.roomId}`} />) : <MikkeEmptyState title="投稿はまだありません" helper="Roomから最初の投稿を作成できます。" />}
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-[color-mix(in_srgb,var(--mikke-yellow)_70%,var(--mikke-line))] bg-[color-mix(in_srgb,var(--mikke-yellow)_18%,white)] p-5">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mikke-primary)]">NEXT EVENT</p><h2 className="mt-1 text-lg font-bold">次の予定</h2></div><CalendarDays className="text-[var(--mikke-primary)]" size={24} /></div>
            {visibleEvents[0] ? <HomeEventCard event={visibleEvents[0]} onUpdate={() => updateAttendance(visibleEvents[0])} /> : <p className="mt-5 rounded-xl bg-white/80 px-4 py-5 text-sm text-[var(--mikke-muted)]">次の予定はまだありません。</p>}
          </section>

          <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mikke-muted-light)]">NEW MEMBERS</p>
            <h2 className="mt-1 text-lg font-bold">新しいメンバー</h2>
            <div className="mt-4 space-y-3">
              {newMembers.map((profile) => <button type="button" onClick={() => setSelectedProfile(profile)} key={profile.userId} className="flex w-full items-center gap-3 rounded-xl p-1 text-left transition hover:bg-[var(--mikke-surface-soft)]"><MemberAvatar name={profile.displayName} avatarUrl={profile.avatarUrl} color={profile.avatarColor} size="sm" /><div className="min-w-0"><p className="truncate text-sm font-bold">{profile.displayName}</p><p className="truncate text-xs text-[var(--mikke-muted-light)]">{profile.bio || "プロフィールはまだ未設定です"}</p></div></button>)}
              {newMembers.length === 0 ? <p className="text-sm text-[var(--mikke-muted)]">メンバーが参加するとここに表示されます。</p> : null}
            </div>
            {data.profile && !data.profile.avatarUrl && !data.profile.bio ? <Link href={`${base}/profile`} className="mt-4 flex items-center justify-between rounded-xl bg-[var(--mikke-accent-soft)] px-3 py-2.5 text-xs font-bold text-[var(--mikke-primary)]">自分のプロフィールを設定する <ArrowRight size={14} /></Link> : null}
          </section>

          {visibleResources.length > 0 ? <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mikke-muted-light)]">PICK UP</p><h2 className="mt-1 text-lg font-bold">資料</h2><div className="mt-3 space-y-1">{visibleResources.slice(0, 3).map((resource) => <a key={resource.id} href={resource.externalUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--mikke-primary)] hover:bg-[var(--mikke-surface-soft)]"><span className="truncate">{resource.title}</span><ArrowRight size={15} /></a>)}</div></section> : null}
        </aside>
      </div>
      {selectedProfile ? <MemberProfilePreview profile={selectedProfile} onClose={() => setSelectedProfile(null)} /> : null}
    </div>
  );
}

function HomeSummaryCard({ icon, label, value, helper, color }: { icon: React.ReactNode; label: string; value: string; helper: string; color: string }) {
  return (
    <article className="min-w-0 rounded-xl border border-[var(--mikke-line-soft)] bg-white px-2 py-2.5 shadow-sm sm:rounded-2xl sm:p-4">
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white sm:h-9 sm:w-9" style={{ background: color }}>{icon}</span><div className="min-w-0"><p className="truncate text-[10px] font-bold text-[var(--mikke-muted)] sm:text-xs">{label}</p><p className="truncate text-sm font-bold tracking-normal sm:text-lg">{value}</p><p className="hidden truncate text-[10px] text-[var(--mikke-muted-light)] sm:block">{helper}</p></div></div>
    </article>
  );
}

function CommunitySearchView({ base, data }: { base: string; data: CommunityDashboard }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommunitySearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearching(true);
    setSearchError("");
    try {
      setResults(await searchCommunity(supabase, data.community.id, data.community.slug, query));
      setSearched(true);
    } catch (error) {
      setSearchError(communityErrorMessage(error, "検索できませんでした。"));
    } finally {
      setSearching(false);
    }
  }
  const labels: Record<CommunitySearchResult["kind"], string> = { room: "Room", post: "投稿", comment: "コメント", chat: "チャット", event: "イベント", resource: "資料" };
  return (
    <section className="mx-auto max-w-4xl">
      <Link href={base} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--mikke-primary)]"><ArrowLeft size={16} />HOMEへ戻る</Link>
      <div className="mt-5 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mikke-muted-light)]">COMMUNITY SEARCH</p>
        <h2 className="mt-1 text-2xl font-bold">Community内を検索</h2>
        <form onSubmit={submit} className="mt-4 flex gap-2"><input required minLength={2} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Room・投稿・コメントを検索" className="min-w-0 flex-1 rounded-xl border border-[var(--mikke-line)] px-4 py-3 text-sm outline-none focus:border-[var(--mikke-primary)]" /><button disabled={searching} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--mikke-primary)] text-white disabled:opacity-60" aria-label="検索"><Search size={19} /></button></form>
        {searchError ? <p className="mt-3 text-sm font-bold text-[var(--mikke-danger)]">{searchError}</p> : null}
      </div>
      <div className="mt-5 space-y-2">
        {results.map((result) => <Link key={`${result.kind}-${result.id}`} href={result.href} className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--mikke-line-soft)] bg-white px-4 py-3 transition hover:border-[var(--mikke-primary)]"><span className="shrink-0 rounded-full bg-[var(--mikke-yellow)] px-2 py-1 text-[10px] font-bold text-[var(--mikke-primary)]">{labels[result.kind]}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{result.title}</span><span className="mt-0.5 block truncate text-xs text-[var(--mikke-muted)]">{result.excerpt || "内容を見る"}</span></span><CircleChevronRight size={20} className="shrink-0 text-[var(--mikke-primary)]" /></Link>)}
        {searched && results.length === 0 ? <MikkeEmptyState title="一致する内容がありません" helper="別の言葉でもう一度検索してみてください。" /> : null}
      </div>
    </section>
  );
}

function BookmarksView({ base, data }: { base: string; data: CommunityDashboard }) {
  const posts = data.posts.filter((post) => post.bookmarkedByMe && !post.isHidden);
  return (
    <section className="mx-auto max-w-4xl">
      <Link href={base} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--mikke-primary)]"><ArrowLeft size={16} />HOMEへ戻る</Link>
      <div className="mt-5 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--mikke-yellow)] text-[var(--mikke-primary)]"><Bookmark size={21} /></span><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mikke-muted-light)]">BOOKMARKS</p><h2 className="text-2xl font-bold">保存した投稿</h2></div></div>
      <div className="mt-5 space-y-3">
        {posts.map((post) => <Link key={post.id} href={`${base}/rooms/${post.roomId}/posts/${post.id}`} className="flex min-w-0 items-center gap-4 rounded-2xl border border-[var(--mikke-line)] bg-white px-4 py-4 shadow-sm transition hover:border-[var(--mikke-primary)]"><MemberAvatar name={post.profile?.displayName} avatarUrl={post.profile?.avatarUrl} color={post.profile?.avatarColor} size="sm" /><span className="min-w-0 flex-1"><span className="block truncate font-bold">{post.title}</span><span className="mt-1 block truncate text-xs text-[var(--mikke-muted)]">{post.body}</span><span className="mt-1 block text-[10px] text-[var(--mikke-muted-light)]">{post.room?.title ?? "Room"} ・ {formatDateTime(post.createdAt)}</span></span><CircleChevronRight size={21} className="shrink-0 text-[var(--mikke-primary)]" /></Link>)}
        {posts.length === 0 ? <MikkeEmptyState title="保存した投稿はありません" helper="投稿画面のしおりアイコンから、あとで読みたい投稿を保存できます。" /> : null}
      </div>
    </section>
  );
}

function HomeRoomCard({ room, profiles, href }: { room: CommunityRoom; profiles: CommunityDashboard["profiles"]; href: string }) {
  const total = room.conversationMode === "chat" ? room.messageCount : room.postCount + room.commentCount;
  return (
    <Link href={href} className="group flex min-w-0 items-center gap-3 rounded-xl border-2 bg-white px-3 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: roomColorValue(room.themeColor) }}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${roomColorValue(room.themeColor)} 28%, white)`, color: "var(--mikke-primary)" }}>{room.conversationMode === "chat" ? <MessagesSquare size={18} /> : <MessageCircle size={18} />}</span>
      <span className="min-w-0 flex-1"><span className="flex min-w-0 items-center gap-2"><span className="truncate text-sm font-bold">{room.title}</span>{room.unreadCount > 0 ? <span className="shrink-0 rounded-full bg-[var(--mikke-primary)] px-1.5 py-0.5 text-[9px] font-bold text-white">{room.unreadCount}</span> : null}</span><span className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--mikke-muted)]"><span>{total}件の会話</span><MiniMemberStack userIds={room.recentSpeakerUserIds.slice(0, 3)} speakerCount={room.speakerCount} profiles={profiles} /></span></span>
      <CircleChevronRight className="shrink-0 text-[var(--mikke-primary)] transition-transform group-hover:translate-x-0.5" size={20} />
    </Link>
  );
}

function MiniMemberStack({ userIds, speakerCount, profiles }: { userIds: string[]; speakerCount: number; profiles: CommunityDashboard["profiles"] }) {
  const profilesByUser = new Map(profiles.map((profile) => [profile.userId, profile]));
  return <span className="flex min-w-0 items-center">{userIds.map((userId, index) => { const profile = profilesByUser.get(userId); return profile?.avatarUrl ? <img key={userId} src={profile.avatarUrl} alt={profile.displayName} className={`h-7 w-7 rounded-full border-2 border-white object-cover ${index > 0 ? "-ml-2" : ""}`} /> : <span key={userId} className={`grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[var(--mikke-pink)] text-[10px] font-bold text-[var(--mikke-primary)] ${index > 0 ? "-ml-2" : ""}`}>{(profile?.displayName ?? "M").slice(0, 1).toUpperCase()}</span>; })}{speakerCount > 5 ? <span className="ml-1 text-xs tracking-widest text-[var(--mikke-muted)]">…</span> : null}</span>;
}

function HomeEventCard({ event, onUpdate }: { event: CommunityEvent; onUpdate: () => Promise<void> }) {
  const date = new Date(event.startsAt);
  return (
    <article className="mt-4 overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--mikke-orange)_35%,var(--mikke-line))] bg-[color-mix(in_srgb,var(--mikke-yellow)_35%,white)] shadow-sm">
      <div className="flex items-stretch"><div className="grid w-20 shrink-0 place-items-center bg-[var(--mikke-orange)] px-2 py-4 text-center text-white"><span><span className="block text-xs font-bold">{date.toLocaleDateString("ja-JP", { month: "short" })}</span><span className="block text-3xl font-bold leading-none">{date.getDate()}</span><span className="mt-1 block text-[10px]">{date.toLocaleDateString("ja-JP", { weekday: "short" })}</span></span></div><div className="min-w-0 flex-1 p-4"><p className="truncate font-bold">{event.title}</p><p className="mt-1 text-xs font-bold text-[var(--mikke-accent-strong)]">{date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</p>{event.locationLabel ? <p className="mt-1 truncate text-xs text-[var(--mikke-muted)]">{event.locationLabel}</p> : null}</div></div>
      <button type="button" onClick={onUpdate} className={`w-full border-t border-[var(--mikke-line-soft)] px-4 py-3 text-xs font-bold ${event.attendeeStatus === "going" ? "bg-[var(--mikke-yellow)] text-[var(--mikke-primary)]" : "text-[var(--mikke-primary)]"}`}>{event.attendeeStatus === "going" ? "✓ 参加予定です" : "参加予定にする"}</button>
    </article>
  );
}

function ActivityListItem({ activity, room, href }: { activity: CommunityActivity; room?: CommunityRoom; href: string }) {
  const label = activity.kind === "chat" ? "チャット" : activity.kind === "comment" ? "コメント" : "投稿";
  return (
    <Link href={href} className="flex min-w-0 gap-2.5 border-l-[3px] px-2 py-3 transition-colors hover:bg-[var(--mikke-surface-soft)] sm:px-4" style={{ borderLeftColor: room ? roomColorValue(room.themeColor) : "var(--mikke-yellow)" }}>
      <MemberAvatar name={activity.profile?.displayName} avatarUrl={activity.profile?.avatarUrl} color={activity.profile?.avatarColor} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-bold">{activity.profile?.displayName ?? "member"}</span>
          <span className="rounded-full bg-[var(--mikke-yellow)] px-2 py-0.5 text-[10px] font-bold text-[var(--mikke-primary)]">{label}</span>
          <span className="text-xs text-[var(--mikke-muted-light)]">{formatDateTime(activity.createdAt)}</span>
        </span>
        <span className="mt-0.5 block truncate text-sm font-bold text-[var(--mikke-text)]">{activity.title}</span>
        <span className="mt-0.5 block truncate text-xs text-[var(--mikke-muted)]">{activity.body}</span>
        {room ? <span className="mt-1 block truncate text-[10px] text-[var(--mikke-muted-light)]">in {room.title}</span> : null}
      </span>
      <CircleChevronRight aria-hidden="true" className="mt-2 shrink-0 text-[var(--mikke-primary)]" size={20} />
    </Link>
  );
}

function MemberProfilePreview({ profile, onClose }: { profile: CommunityDashboard["profiles"][number]; onClose: () => void }) {
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label={`${profile.displayName}のプロフィール`} onClick={onClose}><article onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-3xl border border-[var(--mikke-line)] bg-white p-6 shadow-xl"><div className="flex justify-end"><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--mikke-surface-soft)] text-[var(--mikke-primary)]" aria-label="閉じる"><X size={18} /></button></div><div className="-mt-2 text-center"><div className="inline-flex"><MemberAvatar name={profile.displayName} avatarUrl={profile.avatarUrl} color={profile.avatarColor} /></div><h2 className="mt-3 text-xl font-bold">{profile.displayName}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--mikke-muted)]">{profile.bio || "自己紹介はまだありません。"}</p></div></article></div>;
}

function roomColorValue(color: CommunityRoomColor) {
  return {
    blue: "var(--mikke-blue)",
    orange: "var(--mikke-orange)",
    yellow: "var(--mikke-yellow)",
    pink: "var(--mikke-pink)",
    green: "var(--mikke-green)"
  }[color];
}

function RoomsView({ base, data }: { base: string; data: CommunityDashboard }) {
  const visibleRooms = data.rooms.filter((room) => !room.isArchived && !room.isLocked);
  const profilesByUser = new Map(data.profiles.map((profile) => [profile.userId, profile]));
  return (
    <section className="border-t border-[var(--mikke-line)] pt-5">
      <h2 className="text-2xl font-bold tracking-normal">ROOMS</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {visibleRooms.map((room) => (
          <Link key={room.id} href={`${base}/rooms/${room.id}`} style={{ borderColor: roomColorValue(room.themeColor) }} className="flex items-center gap-4 rounded-2xl border-2 bg-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <h3 className="text-lg font-bold tracking-normal">{room.title}</h3>
              {room.unreadCount > 0 ? <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[var(--mikke-blue)] px-1.5 py-0.5 text-xs font-bold text-white" aria-label={`未読${room.unreadCount}件`}>{room.unreadCount > 99 ? "99+" : room.unreadCount}</span> : null}
            </span>
            {room.description ? <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">{room.description}</p> : null}
            <span className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-[var(--mikke-muted)]">
              <span>{room.conversationMode === "chat" ? `${room.messageCount}件のメッセージ` : `${room.postCount}件の投稿・${room.commentCount}件のコメント`}</span>
              <span className="flex items-center">
                {room.recentSpeakerUserIds.map((speakerId, index) => {
                  const profile = profilesByUser.get(speakerId);
                  return profile?.avatarUrl
                    ? <img key={speakerId} src={profile.avatarUrl} alt={profile.displayName} title={profile.displayName} className={`h-7 w-7 rounded-full border-2 border-white object-cover ${index > 0 ? "-ml-2" : ""}`} />
                    : <span key={speakerId} title={profile?.displayName ?? "member"} className={`grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[var(--mikke-pink)] text-[10px] text-[var(--mikke-primary)] ${index > 0 ? "-ml-2" : ""}`}>{(profile?.displayName ?? "M").slice(0, 1).toUpperCase()}</span>;
                })}
                {room.speakerCount > 5 ? <span className="ml-1 tracking-widest" aria-label={`ほか${room.speakerCount - 5}人`}>…</span> : null}
              </span>
            </span>
            </span>
            <CircleChevronRight aria-hidden="true" className="shrink-0 text-[var(--mikke-primary)]" size={24} />
          </Link>
        ))}
        {visibleRooms.length === 0 ? <MikkeEmptyState title="参加できるRoomはまだありません" helper="運営者が公開したRoomがここに表示されます。" /> : null}
      </div>
    </section>
  );
}

type ViewMutationProps = {
  data: CommunityDashboard;
  userId: string;
  onReload: () => Promise<void>;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
};

function RoomView({ data, userId, roomId, onReload, onMessage, onError }: ViewMutationProps & { roomId?: string }) {
  const base = `/community/c/${encodeURIComponent(data.community.slug)}`;
  const visibleRooms = data.rooms.filter((candidate) => !candidate.isArchived && !candidate.isLocked);
  const room = visibleRooms.find((candidate) => candidate.id === roomId) ?? visibleRooms[0];
  const posts = room ? data.posts.filter((post) => post.roomId === room.id && !post.isHidden) : [];
  const staff = data.community.ownerUserId === userId || data.membership?.role === "owner" || data.membership?.role === "moderator";
  useEffect(() => {
    if (!room) return;
    void markCommunityRoomSeen(supabase, data.community.id, room.id, userId).catch((error) => {
      onError(communityErrorMessage(error, "未読状態を更新できませんでした。"));
    });
  }, [data.community.id, room?.id, userId]);
  if (!room) return <MikkeEmptyState title="Roomがまだありません" helper="運営画面から最初のRoomを作成してください。" />;
  return (
    <section>
      <Link href={`${base}/rooms`} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--mikke-primary)]"><ArrowLeft size={16} /> Room一覧へ戻る</Link>
      <div className="mt-4 border-t-4 pt-5" style={{ borderColor: roomColorValue(room.themeColor) }}>
        <h2 className="text-2xl font-bold tracking-normal">{room.title}</h2>
        {room.description ? <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">{room.description}</p> : null}
      </div>
      {room.conversationMode === "chat" ? (
        <ChatRoomView data={data} room={room} userId={userId} staff={staff} onMessage={onMessage} onError={onError} />
      ) : (
        <>
          {room.memberCanPost ? <div className="mt-5"><PostComposer data={data} userId={userId} defaultRoomId={room.id} onReload={onReload} onMessage={onMessage} onError={onError} /></div> : null}
          <div className="mt-5 divide-y divide-[var(--mikke-line-soft)] border-y border-[var(--mikke-line)] bg-white">
            {posts.length > 0 ? posts.map((post) => <ThreadListItem key={post.id} post={post} href={`${base}/rooms/${room.id}/posts/${post.id}`} />) : <div className="py-4"><MikkeEmptyState title="このRoomの投稿はまだありません" helper={room.memberCanPost ? "最初の話題を投稿できます。" : "運営者からのお知らせをお待ちください。"} /></div>}
          </div>
        </>
      )}
    </section>
  );
}

function ChatRoomView({ data, room, userId, staff, onMessage, onError }: { data: CommunityDashboard; room: CommunityRoom; userId: string; staff: boolean; onMessage: (message: string) => void; onError: (message: string) => void }) {
  const [messages, setMessages] = useState<CommunityChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<CommunityChatMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const activeStamps = data.stamps.filter((stamp) => stamp.isActive);
  const canSend = room.memberCanComment || staff;

  async function reloadMessages(quiet = false) {
    try {
      const next = await loadCommunityChatMessages(supabase, room.id, userId, data.profiles, data.stamps);
      setMessages(next);
      await markCommunityRoomSeen(supabase, data.community.id, room.id, userId);
    } catch (error) {
      if (!quiet) onError(communityErrorMessage(error, "チャットを読み込めませんでした。"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void reloadMessages();
    const channel = supabase
      .channel(`community-chat-${room.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_chat_messages", filter: `room_id=eq.${room.id}` }, () => {
        if (active) void reloadMessages(true);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "community_chat_message_reactions", filter: `room_id=eq.${room.id}` }, () => {
        if (active) void reloadMessages(true);
      })
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [room.id]);

  useEffect(() => {
    timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    try {
      await createCommunityChatMessage(supabase, { communityId: data.community.id, roomId: room.id, authorUserId: userId, body, replyToMessageId: replyTo?.id });
      setBody("");
      setReplyTo(null);
      await reloadMessages(true);
    } catch (error) {
      onError(communityErrorMessage(error, "メッセージを送れませんでした。"));
    } finally {
      setSaving(false);
    }
  }

  async function sendStamp(stampId: string) {
    setSaving(true);
    try {
      await createCommunityChatMessage(supabase, { communityId: data.community.id, roomId: room.id, authorUserId: userId, body: "", replyToMessageId: replyTo?.id, stampId });
      setReplyTo(null);
      await reloadMessages(true);
    } catch (error) {
      onError(communityErrorMessage(error, "スタンプを送れませんでした。"));
    } finally {
      setSaving(false);
    }
  }

  function insertEmoji(emoji: string) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? body.length;
    const end = textarea?.selectionEnd ?? body.length;
    setBody((current) => `${current.slice(0, start)}${emoji}${current.slice(end)}`);
    setShowEmojiPicker(false);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  async function reactToMessage(message: CommunityChatMessage, emoji: string) {
    try {
      await toggleCommunityChatReaction(supabase, { communityId: data.community.id, roomId: room.id, messageId: message.id, userId, emoji });
      await reloadMessages(true);
    } catch (error) {
      onError(communityErrorMessage(error, "リアクションを更新できませんでした。"));
    }
  }

  return (
    <section className="mt-5 overflow-hidden rounded-xl border border-[var(--mikke-line)] bg-[color-mix(in_srgb,var(--mikke-blue)_8%,white)]">
      <div ref={timelineRef} className="max-h-[65vh] min-h-[360px] space-y-3 overflow-y-auto px-3 py-5 sm:px-5">
        {loading ? <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中...</p> : null}
        {!loading && messages.length === 0 ? <MikkeEmptyState title="まだメッセージはありません" helper={canSend ? "最初のメッセージを送ってみましょう。" : "運営者からのメッセージをお待ちください。"} /> : null}
        {messages.map((message) => <ChatMessageRow key={message.id} message={message} own={message.authorUserId === userId} staff={staff} userId={userId} onReply={setReplyTo} onReact={(emoji) => reactToMessage(message, emoji)} onReload={() => reloadMessages(true)} onMessage={onMessage} onError={onError} />)}
      </div>
      {canSend ? (
        <div className="border-t border-[var(--mikke-line)] bg-white p-3 sm:p-4">
          {replyTo ? <div className="mb-2 flex items-center justify-between rounded-lg bg-[var(--mikke-surface-soft)] px-3 py-2 text-xs"><span className="truncate"><Reply size={13} className="mr-1 inline" />{replyTo.profile?.displayName ?? "member"}: {replyTo.stamp ? replyTo.stamp.name : replyTo.body}</span><button type="button" onClick={() => setReplyTo(null)} className="ml-2 font-bold text-[var(--mikke-muted)]">取消</button></div> : null}
          {showEmojiPicker ? (
            <div className="mb-2 flex flex-wrap gap-1.5 rounded-xl border border-[var(--mikke-line-soft)] bg-[var(--mikke-surface-soft)] p-2" aria-label="絵文字を選ぶ">
              {["😊", "😂", "🥰", "😆", "🥳", "👍", "👏", "🙌", "🙏", "🎉", "❤️", "✨", "🔥", "💡", "✅", "🌸"].map((emoji) => <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} className="grid h-9 w-9 place-items-center rounded-lg bg-white text-xl hover:bg-[var(--mikke-yellow)]" aria-label={`${emoji}を入力`}>{emoji}</button>)}
            </div>
          ) : null}
          <form onSubmit={send} className="flex items-end gap-2">
            <button type="button" onClick={() => setShowEmojiPicker((current) => !current)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--mikke-line)] bg-white text-[var(--mikke-primary)]" aria-label="絵文字を選ぶ" aria-expanded={showEmojiPicker}><Smile size={20} /></button>
            <textarea ref={textareaRef} rows={2} maxLength={4000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="メッセージ" className="min-w-0 flex-1 resize-none rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-sm outline-none focus:border-[var(--mikke-accent)]" />
            <button disabled={saving || !body.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--mikke-primary)] text-white disabled:opacity-40" aria-label="送信"><Send size={17} /></button>
          </form>
          {activeStamps.length > 0 ? <div className="mt-2 flex gap-2 overflow-x-auto pb-1">{activeStamps.map((stamp) => <button key={stamp.id} type="button" disabled={saving} onClick={() => sendStamp(stamp.id)} title={stamp.name} className="shrink-0 rounded-lg border border-[var(--mikke-line-soft)] p-1.5 disabled:opacity-40"><img src={stamp.imageUrl} alt={stamp.name} className="h-10 w-10 object-contain" /></button>)}</div> : null}
        </div>
      ) : null}
    </section>
  );
}

function ChatMessageRow({ message, own, staff, userId, onReply, onReact, onReload, onMessage, onError }: { message: CommunityChatMessage; own: boolean; staff: boolean; userId: string; onReply: (message: CommunityChatMessage) => void; onReact: (emoji: string) => Promise<void>; onReload: () => Promise<void>; onMessage: (message: string) => void; onError: (message: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(message.body);
  const [saving, setSaving] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await updateCommunityChatMessage(supabase, message.id, userId, body);
      setEditing(false);
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "メッセージを編集できませんでした。"));
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!window.confirm("このメッセージを削除しますか？")) return;
    setSaving(true);
    try {
      await deleteCommunityChatMessage(supabase, message.id, userId);
      onMessage("メッセージを削除しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "メッセージを削除できませんでした。"));
    } finally { setSaving(false); }
  }

  async function hide() {
    if (!window.confirm("このメッセージを運営判断で非表示にしますか？")) return;
    setSaving(true);
    try {
      await moderateCommunityChatMessage(supabase, message.id, true);
      onMessage("メッセージを非表示にしました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "メッセージを非表示にできませんでした。"));
    } finally { setSaving(false); }
  }

  return (
    <article className={`flex items-end gap-2 ${own ? "justify-end" : "justify-start"}`}>
      {!own ? <MemberAvatar name={message.profile?.displayName} avatarUrl={message.profile?.avatarUrl} color={message.profile?.avatarColor} /> : null}
      <div className={`max-w-[82%] ${own ? "items-end" : "items-start"}`}>
        {!own ? <p className="mb-1 px-1 text-xs font-bold text-[var(--mikke-primary)]">{message.profile?.displayName ?? "member"}</p> : null}
        <div className={`rounded-2xl px-3 py-2 shadow-sm ${own ? "rounded-br-sm bg-[var(--mikke-yellow)]" : "rounded-bl-sm bg-white"}`}>
          {message.replyTo ? <button type="button" onClick={() => onReply(message.replyTo!)} className="mb-2 block w-full border-l-2 border-[var(--mikke-primary)] pl-2 text-left text-[11px] text-[var(--mikke-muted)]"><span className="block font-bold">{message.replyTo.profile?.displayName ?? "member"}</span><span className="block truncate">{message.replyTo.stamp ? message.replyTo.stamp.name : message.replyTo.body}</span></button> : null}
          {message.stamp ? <img src={message.stamp.imageUrl} alt={message.stamp.name} className="h-28 w-28 object-contain" /> : editing ? <form onSubmit={save}><textarea required rows={2} maxLength={4000} value={body} onChange={(event) => setBody(event.target.value)} className="w-full min-w-[220px] rounded-lg border border-[var(--mikke-line)] px-2 py-1.5 text-sm" /><div className="mt-1 flex gap-2"><button disabled={saving} className="text-xs font-bold text-[var(--mikke-primary)]">保存</button><button type="button" onClick={() => setEditing(false)} className="text-xs text-[var(--mikke-muted)]">取消</button></div></form> : <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>}
        </div>
        <div className={`mt-1 flex flex-wrap items-center gap-1 ${own ? "justify-end" : "justify-start"}`}>
          {message.reactions.map((reaction) => <button key={reaction.emoji} type="button" onClick={() => onReact(reaction.emoji)} className={`rounded-full border px-2 py-0.5 text-xs font-bold ${reaction.reactedByMe ? "border-[var(--mikke-blue)] bg-[var(--mikke-blue)] text-white" : "border-[var(--mikke-line)] bg-white text-[var(--mikke-text)]"}`} aria-label={`${reaction.emoji} ${reaction.count}件`}>{reaction.emoji} {reaction.count}</button>)}
          <button type="button" onClick={() => setShowReactions((current) => !current)} className="grid h-7 w-7 place-items-center rounded-full border border-[var(--mikke-line)] bg-white text-[var(--mikke-primary)]" aria-label="リアクションを追加" aria-expanded={showReactions}><Smile size={14} /></button>
        </div>
        {showReactions ? <div className={`mt-1 flex gap-1 rounded-lg border border-[var(--mikke-line-soft)] bg-white p-1.5 ${own ? "justify-end" : "justify-start"}`}>{COMMUNITY_CHAT_REACTIONS.map((emoji) => <button key={emoji} type="button" onClick={async () => { await onReact(emoji); setShowReactions(false); }} className="grid h-8 w-8 place-items-center rounded-md text-lg hover:bg-[var(--mikke-surface-soft)]" aria-label={`${emoji}でリアクション`}>{emoji}</button>)}</div> : null}
        <div className={`mt-1 flex items-center gap-2 px-1 text-[11px] text-[var(--mikke-muted-light)] ${own ? "justify-end" : "justify-start"}`}><span>{formatDateTime(message.createdAt)}{message.editedAt ? "・編集済み" : ""}</span><button type="button" onClick={() => onReply(message)} className="font-bold text-[var(--mikke-primary)]">返信</button>{own && !message.stamp ? <button type="button" onClick={() => setEditing(true)} className="font-bold text-[var(--mikke-primary)]">編集</button> : null}{own ? <button type="button" disabled={saving} onClick={remove} className="font-bold text-[var(--mikke-danger)]">削除</button> : null}{staff && !own ? <button type="button" disabled={saving} onClick={hide} className="font-bold text-[var(--mikke-danger)]">非表示</button> : null}</div>
      </div>
    </article>
  );
}

function ThreadListItem({ post, href }: { post: CommunityPost; href: string }) {
  const commentCount = (post.comments ?? []).filter((comment) => !comment.isHidden).length;
  return (
    <Link href={href} className="flex gap-3 px-2 py-4 transition-colors hover:bg-[var(--mikke-surface-soft)] sm:px-4">
      <MemberAvatar name={post.profile?.displayName} avatarUrl={post.profile?.avatarUrl} color={post.profile?.avatarColor} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-bold text-[var(--mikke-text)]">{post.profile?.displayName ?? "member"}</span>
          <span className="text-xs text-[var(--mikke-muted-light)]">{formatDateTime(post.createdAt)}</span>
          {post.isPinned ? <span className="text-xs font-bold text-[var(--mikke-primary)]">固定</span> : null}
        </span>
        <span className="mt-1 block font-bold text-[var(--mikke-text)]">{post.title}</span>
        <span className="mt-1 block truncate text-sm text-[var(--mikke-muted)]">{post.body}</span>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]"><MessageCircle size={14} /> {commentCount}件のコメント</span>
      </span>
      {post.imageUrl ? <img src={post.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-[var(--mikke-line-soft)] object-cover" /> : null}
    </Link>
  );
}

function PostComposer({ data, userId, defaultRoomId, onReload, onMessage, onError }: ViewMutationProps & { defaultRoomId?: string }) {
  const writableRooms = data.rooms.filter((room) => !room.isArchived && room.conversationMode === "thread" && room.memberCanPost && !room.isLocked);
  const [roomId, setRoomId] = useState(defaultRoomId ?? writableRooms[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roomId) return;
    setSaving(true);
    try {
      const image = imageFile ? await uploadMikkeMediaImage({ userId, file: imageFile, sourceApp: "community-post" }) : null;
      const createdPostId = await createCommunityPost(supabase, { communityId: data.community.id, roomId, authorUserId: userId, title, body, kind: "normal", url, imageUrl: image?.publicUrl });
      if (image) await syncMikkeMediaUsages({ appKey: "community", entityType: "post", entityId: createdPostId, assetIds: [image.id] });
      let attachmentWarning = "";
      if (attachmentFile) {
        try {
          await uploadCommunityPostAttachment(supabase, { communityId: data.community.id, postId: createdPostId, userId, file: attachmentFile });
        } catch (attachmentError) {
          attachmentWarning = communityErrorMessage(attachmentError, "投稿は作成しましたが、ファイルを添付できませんでした。");
        }
      }
      setTitle("");
      setBody("");
      setUrl("");
      setImageFile(null);
      setAttachmentFile(null);
      onMessage(attachmentWarning || "投稿しました。");
      await onReload();
    } catch (nextError) {
      onError(communityErrorMessage(nextError, "投稿に失敗しました。"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="group border border-[var(--mikke-line)] bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-bold text-[var(--mikke-primary)]"><span className="inline-flex items-center gap-2"><Plus size={17} /> 新しく投稿する</span><ChevronDown className="group-open:rotate-180" size={18} /></summary>
      <form onSubmit={submit} className="border-t border-[var(--mikke-line-soft)] p-4">
        {!defaultRoomId ? <select value={roomId} onChange={(event) => setRoomId(event.target.value)} className="mb-3 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-3 py-2 text-sm">{writableRooms.map((room) => <option key={room.id} value={room.id}>{room.title}</option>)}</select> : null}
        <input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="投稿のタイトル" className="w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm outline-none focus:border-[var(--mikke-accent)]" />
        <textarea value={body} onChange={(event) => setBody(event.target.value)} required rows={3} placeholder="話したいことを書いてください" className="mt-3 w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--mikke-accent)]" />
        <ImageFilePicker label="写真を追加（任意）" file={imageFile} onChange={setImageFile} />
        <GenericFilePicker label="ファイルを添付（任意・10MBまで）" file={attachmentFile} onChange={setAttachmentFile} />
        <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="参考URL（任意）" className="mt-3 w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm outline-none focus:border-[var(--mikke-accent)]" />
        <button disabled={saving} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Send size={16} /> {saving ? "投稿中..." : "投稿する"}</button>
      </form>
    </details>
  );
}

function ComposeView({ base, data, userId, onReload, onMessage, onError }: ViewMutationProps & { base: string }) {
  const canPost = data.rooms.some((room) => !room.isArchived && !room.isLocked && room.conversationMode === "thread" && room.memberCanPost);
  return (
    <section className="mx-auto max-w-2xl">
      <Link href={`${base}/rooms`} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--mikke-primary)]"><ArrowLeft size={16} /> Room一覧へ戻る</Link>
      <h2 className="mt-5 text-2xl font-bold tracking-normal">新しい投稿</h2>
      <p className="mt-2 text-sm text-[var(--mikke-muted)]">投稿先のRoomを選んで、写真やメッセージを共有できます。</p>
      <div className="mt-5">{canPost ? <PostComposer data={data} userId={userId} onReload={onReload} onMessage={onMessage} onError={onError} /> : <MikkeEmptyState title="投稿できるRoomがありません" helper="運営者が投稿可能なRoomを公開すると、ここから投稿できます。" />}</div>
    </section>
  );
}

function PostThreadView({ base, data, userId, roomId, postId, onReload, onMessage, onError }: ViewMutationProps & { base: string; roomId?: string; postId?: string }) {
  const room = data.rooms.find((candidate) => candidate.id === roomId && !candidate.isArchived && !candidate.isLocked);
  const post = data.posts.find((candidate) => candidate.id === postId && candidate.roomId === room?.id && !candidate.isHidden);
  if (!room || !post) return <MikkeEmptyState title="投稿を開けません" helper="削除されたか、現在の参加権限では閲覧できません。" />;
  return (
    <section className="max-w-4xl">
      <Link href={`${base}/rooms/${room.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--mikke-primary)]"><ArrowLeft size={16} /> {room.title}へ戻る</Link>
      <Link href={`${base}/help?target=post&id=${post.id}`} className="ml-4 inline-flex items-center gap-1 text-xs font-bold text-[var(--mikke-muted)]"><ShieldCheck size={14} />この投稿を通報</Link>
      <div className="mt-4"><PostCard post={post} stamps={data.stamps.filter((stamp) => stamp.isActive)} userId={userId} canComment={room.memberCanComment} onReload={onReload} onMessage={onMessage} onError={onError} /></div>
    </section>
  );
}

function MemberAvatar({ name, avatarUrl, color = "pink", size = "md" }: { name?: string; avatarUrl?: string | null; color?: CommunityRoomColor; size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  if (avatarUrl) return <img src={avatarUrl} alt="" className={`${sizeClass} shrink-0 rounded-full border border-[var(--mikke-line-soft)] object-cover`} />;
  return <span aria-hidden="true" style={{ background: roomColorValue(color) }} className={`grid ${sizeClass} shrink-0 place-items-center rounded-full font-bold text-[var(--mikke-primary)]`}>{(name ?? "M").trim().slice(0, 1).toUpperCase()}</span>;
}

function PostCard({ post, stamps, userId, canComment, onReload, onMessage, onError }: { post: CommunityPost; stamps: CommunityDashboard["stamps"]; userId: string; canComment: boolean; onReload: () => Promise<void>; onMessage: (message: string) => void; onError: (message: string) => void }) {
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [url, setUrl] = useState(post.url ?? "");
  const ownPost = post.authorUserId === userId;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await createCommunityComment(supabase, post.id, userId, comment);
      setComment("");
      onMessage("コメントしました。");
      await onReload();
    } catch (nextError) {
      onError(communityErrorMessage(nextError, "コメントに失敗しました。"));
    } finally {
      setSaving(false);
    }
  }

  async function sendStamp(stampId: string) {
    setSaving(true);
    try {
      await createCommunityComment(supabase, post.id, userId, "", stampId);
      onMessage("スタンプを送りました。");
      await onReload();
    } catch (nextError) {
      onError(communityErrorMessage(nextError, "スタンプを送れませんでした。"));
    } finally {
      setSaving(false);
    }
  }

  async function savePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await updateCommunityPost(supabase, post.id, { title, body, url, isPinned: post.isPinned });
      setEditing(false);
      onMessage("投稿を更新しました。");
      await onReload();
    } catch (nextError) {
      onError(communityErrorMessage(nextError, "投稿を更新できませんでした。"));
    } finally { setSaving(false); }
  }

  async function removePost() {
    if (!window.confirm("この投稿を削除しますか？コメントも画面から非表示になります。")) return;
    setSaving(true);
    try {
      await deleteCommunityPost(supabase, post.id, userId);
      onMessage("投稿を削除しました。");
      await onReload();
    } catch (nextError) {
      onError(communityErrorMessage(nextError, "投稿を削除できませんでした。"));
    } finally { setSaving(false); }
  }

  async function reactToPost(emoji: string) {
    try {
      await toggleCommunityPostReaction(supabase, { communityId: post.communityId, roomId: post.roomId, postId: post.id, userId, emoji });
      await onReload();
    } catch (nextError) {
      onError(communityErrorMessage(nextError, "リアクションを更新できませんでした。"));
    }
  }

  async function toggleBookmark() {
    setSaving(true);
    try {
      await toggleCommunityPostBookmark(supabase, { communityId: post.communityId, roomId: post.roomId, postId: post.id, userId, bookmarked: post.bookmarkedByMe });
      onMessage(post.bookmarkedByMe ? "保存を解除しました。" : "投稿を保存しました。");
      await onReload();
    } catch (nextError) {
      onError(communityErrorMessage(nextError, "投稿を保存できませんでした。"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="border-t-4 border-[var(--mikke-blue)] bg-white px-4 py-5 sm:px-6">
      <div className="flex items-start gap-3">
        <MemberAvatar name={post.profile?.displayName} avatarUrl={post.profile?.avatarUrl} color={post.profile?.avatarColor} />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{post.profile?.displayName ?? "member"}</p>
          <p className="text-xs text-[var(--mikke-muted-light)]">{formatDateTime(post.createdAt)}{post.updatedAt !== post.createdAt ? "・編集済み" : ""}</p>
        </div>
        <div className="flex gap-1"><button type="button" disabled={saving} onClick={toggleBookmark} className={`rounded-lg p-2 disabled:opacity-50 ${post.bookmarkedByMe ? "bg-[var(--mikke-yellow)] text-[var(--mikke-primary)]" : "text-[var(--mikke-muted)]"}`} aria-label={post.bookmarkedByMe ? "投稿の保存を解除" : "投稿を保存"} title={post.bookmarkedByMe ? "保存済み" : "あとで読む"}><Bookmark size={16} fill={post.bookmarkedByMe ? "currentColor" : "none"} /></button>{ownPost ? <><button type="button" onClick={() => setEditing((value) => !value)} className="p-2 text-[var(--mikke-primary)]" aria-label="投稿を編集"><Pencil size={16} /></button><button type="button" disabled={saving} onClick={removePost} className="p-2 text-[var(--mikke-danger)] disabled:opacity-50" aria-label="投稿を削除"><Trash2 size={16} /></button></> : null}</div>
      </div>
      {editing ? <form onSubmit={savePost} className="mt-4 border-l-4 border-[var(--mikke-pink)] pl-4"><input required value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 font-bold" /><textarea required rows={5} value={body} onChange={(event) => setBody(event.target.value)} className="mt-3 w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm leading-7" /><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="参考URL（任意）" className="mt-3 w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" /><div className="mt-3 flex gap-2"><button disabled={saving} className="rounded-lg bg-[var(--mikke-accent)] px-4 py-2 text-sm font-bold text-white">保存</button><button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-[var(--mikke-line)] px-4 py-2 text-sm font-bold">キャンセル</button></div></form> : <><h3 className="mt-4 text-xl font-bold tracking-normal">{post.title}</h3>{post.imageUrl ? <img src={post.imageUrl} alt="投稿画像" className="mt-4 max-h-[520px] w-full rounded-xl border border-[var(--mikke-line-soft)] object-contain" /> : null}<p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--mikke-text-soft)]">{post.body}</p>{post.url ? <a href={post.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-bold text-[var(--mikke-primary)]">参考リンクを開く</a> : null}{(post.attachments ?? []).length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{(post.attachments ?? []).map((attachment) => <AttachmentButton key={attachment.id} attachment={attachment} onError={onError} />)}</div> : null}</>}
      <div className="mt-4"><ReactionBar reactions={post.reactions} onReact={reactToPost} /></div>
      <div className="mt-4 border-t border-[var(--mikke-line-soft)] pt-3">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--mikke-primary)]">Comments</p>
        <div className="mt-2 space-y-1">{(post.comments ?? []).filter((item) => !item.isHidden).map((item) => <CommentRow key={item.id} comment={item} communityId={post.communityId} roomId={post.roomId} userId={userId} onReload={onReload} onMessage={onMessage} onError={onError} />)}</div>
        {canComment ? <><form onSubmit={submit} className="mt-4 flex items-end gap-2"><input value={comment} onChange={(event) => setComment(event.target.value)} required placeholder="コメント" className="min-w-0 flex-1 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm outline-none focus:border-[var(--mikke-accent)]" /><button disabled={saving} className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--mikke-primary)] text-white disabled:opacity-60" aria-label="コメント"><Send size={16} /></button></form>{stamps.length > 0 ? <div className="mt-3 flex gap-2 overflow-x-auto pb-2">{stamps.map((stamp) => <button key={stamp.id} type="button" disabled={saving} onClick={() => sendStamp(stamp.id)} title={stamp.name} className="shrink-0 rounded-xl border border-[var(--mikke-line)] bg-white p-2 transition hover:border-[var(--mikke-primary)] disabled:opacity-50"><img src={stamp.imageUrl} alt={stamp.name} className="h-12 w-12 object-contain" /></button>)}</div> : null}</> : null}
      </div>
    </article>
  );
}

function ReactionBar({ reactions, onReact }: { reactions: CommunityPost["reactions"]; onReact: (emoji: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {reactions.map((reaction) => <button key={reaction.emoji} type="button" onClick={() => onReact(reaction.emoji)} className={`rounded-full border px-2.5 py-1 text-xs font-bold ${reaction.reactedByMe ? "border-[var(--mikke-blue)] bg-[var(--mikke-blue)] text-white" : "border-[var(--mikke-line)] bg-white"}`}>{reaction.emoji} {reaction.count}</button>)}
      <button type="button" onClick={() => setOpen((current) => !current)} className="grid h-8 w-8 place-items-center rounded-full border border-[var(--mikke-line)] bg-white text-[var(--mikke-primary)]" aria-label="リアクションを追加" aria-expanded={open}><Smile size={15} /></button>
      {open ? <span className="flex gap-1 rounded-xl border border-[var(--mikke-line-soft)] bg-white p-1 shadow-sm">{COMMUNITY_CHAT_REACTIONS.map((emoji) => <button key={emoji} type="button" onClick={async () => { await onReact(emoji); setOpen(false); }} className="grid h-8 w-8 place-items-center rounded-lg text-lg hover:bg-[var(--mikke-surface-soft)]">{emoji}</button>)}</span> : null}
    </div>
  );
}

function CommentRow({ comment, communityId, roomId, userId, onReload, onMessage, onError }: { comment: NonNullable<CommunityPost["comments"]>[number]; communityId: string; roomId: string; userId: string; onReload: () => Promise<void>; onMessage: (message: string) => void; onError: (message: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);
  const [saving, setSaving] = useState(false);
  const ownComment = comment.authorUserId === userId;
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); try { await updateCommunityComment(supabase, comment.id, userId, body); setEditing(false); onMessage("コメントを更新しました。"); await onReload(); } catch (error) { onError(communityErrorMessage(error, "コメントを更新できませんでした。")); } finally { setSaving(false); } }
  async function remove() { if (!window.confirm("このコメントを削除しますか？")) return; setSaving(true); try { await deleteCommunityComment(supabase, comment.id, userId); onMessage("コメントを削除しました。"); await onReload(); } catch (error) { onError(communityErrorMessage(error, "コメントを削除できませんでした。")); } finally { setSaving(false); } }
  async function react(emoji: string) { try { await toggleCommunityCommentReaction(supabase, { communityId, roomId, postId: comment.postId, commentId: comment.id, userId, emoji }); await onReload(); } catch (error) { onError(communityErrorMessage(error, "リアクションを更新できませんでした。")); } }
  return <div className="flex gap-3 border-l-4 border-[var(--mikke-pink)] bg-[var(--mikke-surface-soft)] px-3 py-3"><MemberAvatar name={comment.profile?.displayName} avatarUrl={comment.profile?.avatarUrl} color={comment.profile?.avatarColor} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold">{comment.profile?.displayName ?? "member"}</span><span className="text-xs text-[var(--mikke-muted-light)]">{formatDateTime(comment.createdAt)}{comment.updatedAt !== comment.createdAt ? "・編集済み" : ""}</span></div>{comment.stamp ? <img src={comment.stamp.imageUrl} alt={comment.stamp.name} className="mt-2 h-24 w-24 object-contain" /> : editing ? <form onSubmit={save} className="mt-2"><textarea required rows={2} value={body} onChange={(event) => setBody(event.target.value)} className="w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" /><div className="mt-2 flex gap-2"><button disabled={saving} className="text-xs font-bold text-[var(--mikke-primary)]">保存</button><button type="button" onClick={() => setEditing(false)} className="text-xs font-bold text-[var(--mikke-muted)]">キャンセル</button></div></form> : <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--mikke-text-soft)]">{comment.body}</p>}<div className="mt-2"><ReactionBar reactions={comment.reactions} onReact={react} /></div></div>{ownComment && !editing ? <div className="flex">{!comment.stamp ? <button type="button" onClick={() => setEditing(true)} className="p-1.5 text-[var(--mikke-primary)]" aria-label="コメントを編集"><Pencil size={14} /></button> : null}<button type="button" disabled={saving} onClick={remove} className="p-1.5 text-[var(--mikke-danger)]" aria-label="コメントを削除"><Trash2 size={14} /></button></div> : null}</div>;
}

function EventsView({ events, userId, onReload, onMessage, onError }: { events: CommunityEvent[]; userId: string; onReload: () => Promise<void>; onMessage: (message: string) => void; onError: (message: string) => void }) {
  const visibleEvents = events.filter((event) => event.status !== "cancelled");
  async function update(eventId: string, status: "going" | "cancelled") {
    try {
      await setEventAttendance(supabase, eventId, userId, status);
      onMessage(status === "going" ? "参加予定にしました。" : "参加予定を取り消しました。");
      await onReload();
    } catch (nextError) {
      onError(communityErrorMessage(nextError, "参加予定を更新できませんでした。"));
    }
  }

  return (
    <section className="border-t border-[var(--mikke-line)] pt-5">
      <h2 className="text-2xl font-bold tracking-normal">EVENTS</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {visibleEvents.map((event) => (
          <article key={event.id} className="rounded-lg border border-[var(--mikke-line)] bg-white p-5">
            <MikkeStatusBadge tone={event.status === "open" ? "success" : "muted"}>{event.status}</MikkeStatusBadge>
            <h3 className="mt-3 text-lg font-bold tracking-normal">{event.title}</h3>
            <p className="mt-1 text-sm font-bold text-[var(--mikke-primary)]">{formatDateTime(event.startsAt)}</p>
            {event.description ? <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">{event.description}</p> : null}
            {event.locationLabel ? <p className="mt-2 text-xs font-bold text-[var(--mikke-muted-light)]">{event.locationLabel}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => update(event.id, event.attendeeStatus === "going" ? "cancelled" : "going")} className="rounded-lg bg-[var(--mikke-accent)] px-3 py-2 text-xs font-bold text-white">
                {event.attendeeStatus === "going" ? "取り消す" : "参加予定"}
              </button>
              {event.externalUrl ? <a href={event.externalUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]">詳細</a> : null}
            </div>
          </article>
        ))}
        {visibleEvents.length === 0 ? <MikkeEmptyState title="イベントはまだありません" helper="説明会や体験会を追加するとここに並びます。" /> : null}
      </div>
    </section>
  );
}

function LibraryView({ data }: { data: CommunityDashboard }) {
  const visibleResources = data.resources.filter((resource) => resource.isPublished);
  return (
    <section className="border-t border-[var(--mikke-line)] pt-5">
      <h2 className="text-2xl font-bold tracking-normal">LIBRARY</h2>
      <div className="mt-4 space-y-3">
        {visibleResources.map((resource) => (
          <a key={resource.id} href={resource.externalUrl} target="_blank" rel="noreferrer" className="flex items-start gap-3 rounded-lg border border-[var(--mikke-line)] bg-white p-4">
            <BookOpen className="mt-0.5 shrink-0 text-[var(--mikke-primary)]" size={18} />
            <span className="min-w-0">
              <span className="block text-sm font-bold text-[var(--mikke-text)]">{resource.title}</span>
              {resource.description ? <span className="mt-1 block text-xs leading-5 text-[var(--mikke-muted)]">{resource.description}</span> : null}
            </span>
          </a>
        ))}
        {visibleResources.length === 0 ? <MikkeEmptyState title="資料リンクはまだありません" helper="PDFや動画、説明ページのURLを運営画面から追加できます。" /> : null}
      </div>
    </section>
  );
}

function ProfileView({ data, userId, onReload, onMessage, onError }: ViewMutationProps) {
  const [displayName, setDisplayName] = useState(data.profile?.displayName ?? "");
  const [bio, setBio] = useState(data.profile?.bio ?? "");
  const [avatarColor, setAvatarColor] = useState<CommunityRoomColor>(data.profile?.avatarColor ?? "pink");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [payerName, setPayerName] = useState(data.profile?.displayName ?? "");
  const [paymentReference, setPaymentReference] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const avatar = avatarFile ? await uploadMikkeMediaImage({ userId, file: avatarFile, sourceApp: "community-profile" }) : null;
      await saveCommunityProfile(supabase, data.community.id, userId, displayName, bio, avatarColor, avatar?.publicUrl);
      if (avatar) await syncMikkeMediaUsages({ appKey: "community", entityType: "member-profile", entityId: `${data.community.id}:${userId}`, assetIds: [avatar.id] });
      setAvatarFile(null);
      onMessage("プロフィールを保存しました。");
      await onReload();
    } catch (nextError) {
      onError(communityErrorMessage(nextError, "プロフィールを保存できませんでした。"));
    } finally {
      setSaving(false);
    }
  }

  async function requestData(requestType: "data_export" | "personal_data_delete") {
    setRequesting(true);
    try {
      await createCommunityDataRequest(supabase, data.community.id, userId, requestType);
      onMessage(requestType === "data_export" ? "データ開示申請を受け付けました。" : "個人データ削除申請を受け付けました。");
      await onReload();
    } catch (nextError) {
      onError(communityErrorMessage(nextError, "申請を受け付けられませんでした。"));
    } finally {
      setRequesting(false);
    }
  }

  async function submitPaymentClaim(planId: string) {
    if (!payerName.trim()) return onError("決済に使用した名義を入力してください。");
    setRequesting(true);
    try {
      await createCommunityPaymentClaim(supabase, data.community.id, planId, userId, payerName, paymentReference, "");
      onMessage("支払い確認を申請しました。運営の確認後に利用権限が反映されます。");
      setPaymentReference("");
      await onReload();
    } catch (nextError) {
      onError(communityErrorMessage(nextError, "支払い確認を申請できませんでした。"));
    } finally {
      setRequesting(false);
    }
  }

  async function leave() {
    if (!window.confirm(`${data.community.name}を退会しますか？閲覧・投稿権限はすぐに停止します。`)) return;
    setRequesting(true);
    try {
      await leaveCommunity(supabase, data.community.id);
      window.location.href = "/community";
    } catch (nextError) {
      onError(communityErrorMessage(nextError, "退会処理を完了できませんでした。"));
      setRequesting(false);
    }
  }

  return (
    <section className="max-w-3xl space-y-6 border-t border-[var(--mikke-line)] pt-5">
      <div><p className="text-xs font-bold text-[var(--mikke-muted-light)]">ACCOUNT</p><h2 className="mt-1 text-2xl font-bold tracking-normal">MY PAGE</h2><p className="mt-2 text-sm text-[var(--mikke-muted)]">プロフィール、会員プラン、退会・個人データの手続きをまとめています。</p></div>
      <form onSubmit={submit} className="rounded-lg border border-[var(--mikke-line)] bg-white p-5">
      <h3 className="text-lg font-bold">プロフィール</h3>
      <div className="mt-4 flex items-center gap-4"><MemberAvatar name={displayName} avatarUrl={data.profile?.avatarUrl} color={avatarColor} /><div className="min-w-0 flex-1"><ImageFilePicker label="プロフィール画像を選ぶ" file={avatarFile} onChange={setAvatarFile} compact /></div></div>
      <fieldset className="mt-4"><legend className="text-sm font-bold">プロフィールカラー</legend><div className="mt-2 grid grid-cols-5 gap-2">{COMMUNITY_AVATAR_COLORS.map((option) => <button key={option.value} type="button" onClick={() => setAvatarColor(option.value)} aria-pressed={avatarColor === option.value} className={`rounded-xl border-2 px-1 py-2 text-[10px] font-bold sm:text-xs ${avatarColor === option.value ? "border-[var(--mikke-primary)]" : "border-[var(--mikke-line)]"}`}><span className="mx-auto mb-1 block h-7 w-7 rounded-full" style={{ background: roomColorValue(option.value) }} />{option.label}</button>)}</div></fieldset>
      <label className="mt-4 block">
        <span className="text-sm font-bold">表示名</span>
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] px-4 py-3 outline-none focus:border-[var(--mikke-accent)]" />
      </label>
      <label className="mt-4 block">
        <span className="text-sm font-bold">自己紹介</span>
        <textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={5} className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] px-4 py-3 leading-6 outline-none focus:border-[var(--mikke-accent)]" />
      </label>
      <button disabled={saving} className="mt-4 rounded-lg bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? "保存中..." : "保存"}</button>
      </form>

      <section className="rounded-lg border border-[var(--mikke-line)] bg-white p-5">
        <h3 className="text-lg font-bold">会員情報</h3>
        <p className="mt-2 text-sm text-[var(--mikke-muted)]">現在の役割: {data.membership?.role ?? "未参加"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.entitlements.filter(isEffectiveEntitlement).map((item) => <MikkeStatusBadge key={item.id} tone="primary">{item.entitlementKey} ・ {entitlementSourceLabel(item.source)}</MikkeStatusBadge>)}
          {data.entitlements.every((item) => !isEffectiveEntitlement(item)) ? <span className="text-sm text-[var(--mikke-muted)]">追加の利用権限はありません。</span> : null}
        </div>
      </section>

      {data.membershipPlans.filter((plan) => plan.status === "active").length > 0 ? <section className="rounded-lg border border-[var(--mikke-line)] bg-white p-5">
        <h3 className="text-lg font-bold">有料会員プラン</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">決済はこのCommunityの運営者が契約する外部サービスで行います。mikkeは決済情報を保持しません。</p>
        <div className="mt-4 grid gap-3">
          {data.membershipPlans.filter((plan) => plan.status === "active").map((plan) => {
            const matchingEntitlements = data.entitlements.filter((item) => isEffectiveEntitlement(item) && item.entitlementKey === plan.entitlementKey);
            const isAlreadyEntitled = matchingEntitlements.length > 0;
            return (
              <article key={plan.id} className="rounded-lg border border-[var(--mikke-line-soft)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold">{plan.name}</p><p className="mt-1 text-sm text-[var(--mikke-muted)]">{plan.description}</p></div><p className="font-bold text-[var(--mikke-primary)]">¥{plan.amountYen.toLocaleString()} / {plan.billingInterval === "month" ? "月" : plan.billingInterval === "year" ? "年" : "1回"}</p></div>
                {isAlreadyEntitled ? (
                  <div className="mt-3 rounded-lg bg-[var(--mikke-surface-soft)] px-4 py-3 text-sm font-bold text-[var(--mikke-primary)]">この利用範囲は利用中です（{[...new Set(matchingEntitlements.map((item) => entitlementSourceLabel(item.source)))].join("・")}）</div>
                ) : (
                  <>
                    <a href={plan.externalPaymentUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg bg-[var(--mikke-primary)] px-4 py-2 text-sm font-bold text-white">{plan.paymentProviderLabel}で支払う</a>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2"><input value={payerName} onChange={(event) => setPayerName(event.target.value)} placeholder="決済名義" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm"/><input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="決済番号（任意）" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm"/></div>
                    <button type="button" disabled={requesting || data.paymentClaims.some((claim) => claim.planId === plan.id && claim.status === "pending")} onClick={() => submitPaymentClaim(plan.id)} className="mt-2 rounded-lg border border-[var(--mikke-line)] px-4 py-2 text-xs font-bold text-[var(--mikke-primary)] disabled:opacity-50">{data.paymentClaims.some((claim) => claim.planId === plan.id && claim.status === "pending") ? "確認待ち" : "支払い確認を申請"}</button>
                  </>
                )}
              </article>
            );
          })}
        </div>
      </section> : null}

      <section className="rounded-lg border border-[var(--mikke-line)] bg-white p-5">
        <h3 className="text-lg font-bold">データと退会</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">退会すると閲覧・投稿権限はすぐ停止します。会話の整合性や不正対応の記録として投稿が残る場合があります。データ開示・個人データ削除は本人確認後に運営が処理します。</p>
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={requesting} onClick={() => requestData("data_export")} className="rounded-lg border border-[var(--mikke-line)] px-4 py-2 text-sm font-bold text-[var(--mikke-primary)]">データ開示を申請</button><button type="button" disabled={requesting} onClick={() => requestData("personal_data_delete")} className="rounded-lg border border-[var(--mikke-line)] px-4 py-2 text-sm font-bold text-[var(--mikke-danger)]">個人データ削除を申請</button><button type="button" disabled={requesting} onClick={leave} className="rounded-lg bg-[var(--mikke-danger)] px-4 py-2 text-sm font-bold text-white">Communityを退会</button></div>
        {data.dataRequests.length > 0 ? <div className="mt-4 space-y-2">{data.dataRequests.map((request) => <p key={request.id} className="text-xs text-[var(--mikke-muted)]">{request.requestType === "data_export" ? "データ開示" : "個人データ削除"}: {request.status}</p>)}</div> : null}
      </section>
    </section>
  );
}

function OwnerView({ base, data, ownerLike }: { base: string; data: CommunityDashboard; ownerLike: boolean }) {
  return (
    <section className="space-y-5 border-t border-[var(--mikke-line)] pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <MikkeStatusBadge tone={ownerLike ? "success" : "muted"}>{ownerLike ? "運営権限" : "閲覧モード"}</MikkeStatusBadge>
          <h2 className="mt-3 text-2xl font-bold tracking-normal">OWNER</h2>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="参加者" value={String(data.ownerMembers.length || (data.membership ? 1 : 0))} />
        <Metric label="Room" value={String(data.rooms.length)} />
        <Metric label="投稿" value={String(data.posts.length)} />
        <Metric label="利用権限定義" value={String(data.entitlementDefinitions.length)} />
      </div>
      {ownerLike ? (
        <div className="grid gap-3 md:grid-cols-4">
          <OwnerLink href={`${base}/owner/settings`} icon={Settings} title="基本設定" helper="名前・説明・参加方式" />
          <OwnerLink href={`${base}/owner/billing`} icon={CreditCard} title="契約・料金" helper="利用プランと人数上限" />
          <OwnerLink href={`${base}/owner/rooms`} icon={MessagesSquare} title="Room設定" helper="無料・限定・運営Room" />
          <OwnerLink href={`${base}/owner/members`} icon={KeyRound} title="参加者と権限" helper="手動で利用権限を付与" />
          <OwnerLink href={`${base}/owner/content`} icon={BookOpen} title="コンテンツ管理" helper="告知・イベント・資料" />
          <OwnerLink href={`${base}/owner/safety`} icon={ShieldCheck} title="参加・安全設定" helper="参加承認・規約・禁止ワード" />
          <OwnerLink href={`${base}/owner/moderation`} icon={MessageCircle} title="通報・問い合わせ" helper="確認・対応・記録" />
        </div>
      ) : null}
      {!ownerLike ? <MikkeEmptyState title="運営操作は owner / moderator のみです" helper="最初の参加者、またはDB上でroleを付与されたユーザーが運営画面を操作できます。" /> : null}
    </section>
  );
}

function OwnerBillingView({ data, ownerLike }: { data: CommunityDashboard; ownerLike: boolean }) {
  if (!ownerLike) return <MikkeEmptyState title="運営権限が必要です" helper="契約・料金はownerまたはmoderatorが確認できます。" />;

  const subscription = data.platformSubscription;
  const currentPlan = getCommunityPlatformPlan(subscription?.planKey);
  const activeMembers = data.ownerMembers.filter((member) => member.membership.status === "active").length;
  const remainingMembers = currentPlan.memberLimit === null ? null : Math.max(0, currentPlan.memberLimit - activeMembers);
  const usagePercent = currentPlan.memberLimit === null ? 0 : Math.min(100, Math.round((activeMembers / currentPlan.memberLimit) * 100));
  const statusLabels = {
    trialing: "トライアル中",
    active: "契約中",
    past_due: "支払い確認が必要",
    cancelled: "解約済み",
    suspended: "利用停止中"
  } as const;
  const periodEndLabel = subscription?.currentPeriodEndsAt
    ? new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric" }).format(new Date(subscription.currentPeriodEndsAt))
    : null;

  return (
    <section className="space-y-6 border-t border-[var(--mikke-line)] pt-5">
      <div>
        <p className="text-xs font-bold tracking-[0.18em] text-[var(--mikke-muted-light)]">COMMUNITY PLAN</p>
        <h2 className="mt-2 text-2xl font-bold tracking-normal">契約・料金</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--mikke-muted)]">Communityを運営する本部がmikkeへ支払うアプリ利用料です。参加者から受け取る会費とは別で、参加者会費へのmikkeの売上手数料はありません。</p>
      </div>

      <section className="grid gap-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-5 md:grid-cols-[1fr_1.4fr]">
        <div>
          <MikkeStatusBadge tone={subscription?.status === "past_due" || subscription?.status === "suspended" ? "muted" : "success"}>{statusLabels[subscription?.status ?? "trialing"]}</MikkeStatusBadge>
          <p className="mt-3 text-3xl font-bold text-[var(--mikke-primary)]">{currentPlan.name}</p>
          <p className="mt-1 text-sm text-[var(--mikke-muted)]">{currentPlan.monthlyAmountYen === null ? "個別見積" : currentPlan.monthlyAmountYen === 0 ? "0円 / 30日" : `月額 ${currentPlan.monthlyAmountYen.toLocaleString()}円（税込）`}</p>
          {periodEndLabel ? <p className="mt-2 text-xs text-[var(--mikke-muted-light)]">現在の期間：{periodEndLabel}まで</p> : null}
        </div>
        <div className="rounded-xl bg-[var(--mikke-surface-soft)] p-4">
          <div className="flex items-end justify-between gap-3">
            <div><p className="text-xs font-bold text-[var(--mikke-muted)]">参加人数</p><p className="mt-1 text-2xl font-bold">{activeMembers}名 <span className="text-sm font-normal text-[var(--mikke-muted)]">/ {currentPlan.memberLimit === null ? "上限個別設定" : `${currentPlan.memberLimit}名`}</span></p></div>
            {remainingMembers !== null ? <p className="text-xs font-bold text-[var(--mikke-primary)]">あと{remainingMembers}名</p> : null}
          </div>
          {currentPlan.memberLimit !== null ? <div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[var(--mikke-accent)] transition-[width]" style={{ width: `${usagePercent}%` }} /></div> : null}
          {remainingMembers === 0 ? <p className="mt-3 text-xs font-bold text-[var(--mikke-danger)]">上限に達しています。新しい参加者の承認には上位プランが必要です。</p> : null}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-bold">料金プラン</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {COMMUNITY_PLATFORM_PLANS.map((plan) => {
            const selected = plan.key === currentPlan.key;
            return <article key={plan.key} className={`rounded-xl border bg-white p-4 ${selected ? "border-[var(--mikke-primary)]" : "border-[var(--mikke-line)]"}`}>
              <div className="flex items-center justify-between gap-2"><p className="font-bold">{plan.name}</p>{selected ? <MikkeStatusBadge tone="primary">現在</MikkeStatusBadge> : null}</div>
              <p className="mt-3 text-xl font-bold text-[var(--mikke-primary)]">{plan.monthlyAmountYen === null ? "個別見積" : plan.monthlyAmountYen === 0 ? "0円" : `${plan.monthlyAmountYen.toLocaleString()}円`}</p>
              <p className="mt-1 text-xs text-[var(--mikke-muted)]">{plan.key === "trial" ? "30日間" : plan.monthlyAmountYen === null ? "1,001名以上" : `月額・${plan.memberLimit?.toLocaleString()}名まで`}</p>
              <p className="mt-3 text-xs leading-5 text-[var(--mikke-muted)]">{plan.helper}</p>
              <p className={`mt-4 rounded-lg px-3 py-2 text-center text-xs font-bold ${selected ? "bg-[var(--mikke-primary)] text-white" : "bg-[var(--mikke-surface-soft)] text-[var(--mikke-muted)]"}`}>{selected ? "利用中" : "オンライン申込準備中"}</p>
            </article>;
          })}
        </div>
        <p className="mt-3 text-xs leading-5 text-[var(--mikke-muted)]">プラン変更とオンライン決済はStripe Billing接続後に利用できます。現時点では契約状況と人数上限の確認画面です。</p>
      </section>
    </section>
  );
}

function OwnerLink({ href, icon: Icon, title, helper }: { href: string; icon: typeof Settings; title: string; helper: string }) {
  return (
    <Link href={href} className="rounded-lg border border-[var(--mikke-line)] bg-white p-5">
      <Icon size={20} className="text-[var(--mikke-primary)]" />
      <p className="mt-3 text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs text-[var(--mikke-muted)]">{helper}</p>
    </Link>
  );
}

function OwnerContentView({ data, userId, ownerLike, onReload, onMessage, onError }: ViewMutationProps & { ownerLike: boolean }) {
  if (!ownerLike) return <MikkeEmptyState title="運営権限が必要です" helper="告知・イベント・資料の管理はownerまたはmoderatorが操作できます。" />;
  return (
    <section className="space-y-6 border-t border-[var(--mikke-line)] pt-5">
      <div>
        <p className="text-xs font-bold uppercase text-[var(--mikke-muted-light)]">CONTENT</p>
        <h2 className="mt-1 text-2xl font-bold tracking-normal">コンテンツ管理</h2>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <OwnerPostManager data={data} userId={userId} onReload={onReload} onMessage={onMessage} onError={onError} />
        <OwnerEventManager data={data} onReload={onReload} onMessage={onMessage} onError={onError} />
        <div className="xl:col-span-2">
          <OwnerStampManager data={data} userId={userId} onReload={onReload} onMessage={onMessage} onError={onError} />
        </div>
        <div className="xl:col-span-2">
          <OwnerResourceManager data={data} onReload={onReload} onMessage={onMessage} onError={onError} />
        </div>
      </div>
    </section>
  );
}

function OwnerPostManager({ data, userId, onReload, onMessage, onError }: ViewMutationProps) {
  const defaultRoomId = data.rooms.find((room) => !room.isArchived && room.conversationMode === "thread" && room.kind === "announcement" && !room.isLocked)?.id ?? data.rooms.find((room) => !room.isArchived && room.conversationMode === "thread" && !room.isLocked)?.id ?? "";
  const [roomId, setRoomId] = useState(defaultRoomId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [isPinned, setIsPinned] = useState(true);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roomId) return;
    setSaving(true);
    try {
      await createCommunityPost(supabase, { communityId: data.community.id, roomId, authorUserId: userId, title, body, kind: "announcement", url, isPinned });
      setTitle("");
      setBody("");
      setUrl("");
      onMessage("告知を投稿しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "告知を投稿できませんでした。"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-[var(--mikke-line)] bg-white p-5">
      <h3 className="text-base font-bold tracking-normal">告知を作る</h3>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <select required value={roomId} onChange={(event) => setRoomId(event.target.value)} className="w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm">
          <option value="">投稿先Room</option>
          {data.rooms.filter((room) => !room.isArchived && room.conversationMode === "thread" && !room.isLocked).map((room) => <option key={room.id} value={room.id}>{room.title}</option>)}
        </select>
        <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="タイトル" className="w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
        <textarea required value={body} onChange={(event) => setBody(event.target.value)} placeholder="本文" rows={5} className="w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm leading-6" />
        <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="URL（任意）" className="w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 text-sm font-bold text-[var(--mikke-muted)]">
          <input type="checkbox" checked={isPinned} onChange={(event) => setIsPinned(event.target.checked)} />
          HOMEに固定表示する
        </label>
        <button disabled={saving || !roomId} className="rounded-lg bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "投稿中..." : "告知を投稿"}</button>
      </form>
      <div className="mt-5 space-y-2">
        {data.posts.slice(0, 5).map((post) => <OwnerPostRow key={post.id} post={post} onReload={onReload} onMessage={onMessage} onError={onError} />)}
      </div>
    </section>
  );
}

function OwnerPostRow({ post, onReload, onMessage, onError }: { post: CommunityPost; onReload: () => Promise<void>; onMessage: (message: string) => void; onError: (message: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [url, setUrl] = useState(post.url ?? "");
  const [isPinned, setIsPinned] = useState(post.isPinned);
  const [saving, setSaving] = useState(false);

  async function update(input: { isHidden?: boolean; isPinned?: boolean }) {
    try {
      await updateCommunityPostVisibility(supabase, post.id, input);
      onMessage("投稿を更新しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "投稿を更新できませんでした。"));
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await updateCommunityPost(supabase, post.id, { title, body, url, isPinned });
      setEditing(false);
      onMessage("投稿内容を保存しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "投稿内容を保存できませんでした。"));
    } finally {
      setSaving(false);
    }
  }
  return (
    <article className="rounded-lg border border-[var(--mikke-line-soft)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-sm font-bold">{post.title}</p><p className="text-xs text-[var(--mikke-muted)]">{post.room?.title ?? "Room"} / {formatDateTime(post.createdAt)} / {post.isHidden ? "非表示" : "公開中"}</p></div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setEditing((value) => !value)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-1.5 text-xs font-bold text-[var(--mikke-primary)]">{editing ? "閉じる" : "編集"}</button>
          <button type="button" onClick={() => update({ isPinned: !post.isPinned })} className="rounded-lg border border-[var(--mikke-line)] px-3 py-1.5 text-xs font-bold text-[var(--mikke-primary)]">{post.isPinned ? "固定解除" : "固定"}</button>
          <button type="button" onClick={() => update({ isHidden: !post.isHidden })} className="rounded-lg border border-[var(--mikke-line)] px-3 py-1.5 text-xs font-bold text-[var(--mikke-danger)]">{post.isHidden ? "再表示" : "非表示"}</button>
        </div>
      </div>
      {editing ? (
        <form onSubmit={save} className="mt-3 space-y-2 border-t border-[var(--mikke-line-soft)] pt-3">
          <input required value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
          <textarea required value={body} onChange={(event) => setBody(event.target.value)} rows={4} className="w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm leading-6" />
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="URL（任意）" className="w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-xs font-bold text-[var(--mikke-muted)]"><input type="checkbox" checked={isPinned} onChange={(event) => setIsPinned(event.target.checked)} />HOMEに固定表示する</label>
          <button disabled={saving} className="rounded-lg bg-[var(--mikke-accent)] px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{saving ? "保存中..." : "保存"}</button>
        </form>
      ) : null}
    </article>
  );
}

function OwnerEventManager({ data, onReload, onMessage, onError }: { data: CommunityDashboard; onReload: () => Promise<void>; onMessage: (message: string) => void; onError: (message: string) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await createCommunityEvent(supabase, data.community.id, { title, description, startsAt, endsAt, locationLabel, externalUrl });
      setTitle("");
      setDescription("");
      setStartsAt("");
      setEndsAt("");
      setLocationLabel("");
      setExternalUrl("");
      onMessage("イベントを作成しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "イベントを作成できませんでした。"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-[var(--mikke-line)] bg-white p-5">
      <h3 className="text-base font-bold tracking-normal">イベントを作る</h3>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="イベント名" className="w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
        <div className="grid gap-3 md:grid-cols-2">
          <input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
          <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
        </div>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="説明" rows={3} className="w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm leading-6" />
        <input value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} placeholder="場所 / Zoomなど" className="w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
        <input value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="詳細URL（任意）" className="w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
        <button disabled={saving} className="rounded-lg bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "作成中..." : "イベントを作成"}</button>
      </form>
      <div className="mt-5 space-y-2">
        {data.events.slice(0, 5).map((event) => <OwnerEventRow key={event.id} event={event} onReload={onReload} onMessage={onMessage} onError={onError} />)}
      </div>
    </section>
  );
}

function OwnerEventRow({ event, onReload, onMessage, onError }: { event: CommunityEvent; onReload: () => Promise<void>; onMessage: (message: string) => void; onError: (message: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [startsAt, setStartsAt] = useState(formatDateTimeInput(event.startsAt));
  const [endsAt, setEndsAt] = useState(formatDateTimeInput(event.endsAt));
  const [locationLabel, setLocationLabel] = useState(event.locationLabel ?? "");
  const [externalUrl, setExternalUrl] = useState(event.externalUrl ?? "");
  const [status, setStatus] = useState(event.status);
  const [saving, setSaving] = useState(false);

  async function update(status: "open" | "closed" | "cancelled") {
    try {
      await updateCommunityEventStatus(supabase, event.id, status);
      onMessage("イベントを更新しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "イベントを更新できませんでした。"));
    }
  }
  async function save(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setSaving(true);
    try {
      await updateCommunityEvent(supabase, event.id, { title, description, startsAt, endsAt, locationLabel, externalUrl, status });
      setEditing(false);
      onMessage("イベント内容を保存しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "イベント内容を保存できませんでした。"));
    } finally {
      setSaving(false);
    }
  }
  return (
    <article className="rounded-lg border border-[var(--mikke-line-soft)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-sm font-bold">{event.title}</p><p className="text-xs text-[var(--mikke-muted)]">{formatDateTime(event.startsAt)} / {event.status}</p></div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setEditing((value) => !value)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-1.5 text-xs font-bold text-[var(--mikke-primary)]">{editing ? "閉じる" : "編集"}</button>
          <button type="button" onClick={() => update(event.status === "open" ? "closed" : "open")} className="rounded-lg border border-[var(--mikke-line)] px-3 py-1.5 text-xs font-bold text-[var(--mikke-primary)]">{event.status === "open" ? "受付終了" : "受付再開"}</button>
          <button type="button" onClick={() => update("cancelled")} className="rounded-lg border border-[var(--mikke-line)] px-3 py-1.5 text-xs font-bold text-[var(--mikke-danger)]">中止</button>
        </div>
      </div>
      {editing ? (
        <form onSubmit={save} className="mt-3 space-y-2 border-t border-[var(--mikke-line-soft)] pt-3">
          <input required value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
          <div className="grid gap-2 md:grid-cols-2">
            <input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
            <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
          </div>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm leading-6" />
          <input value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} placeholder="場所 / Zoomなど" className="w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
          <input value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="詳細URL（任意）" className="w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
          <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm"><option value="open">open</option><option value="closed">closed</option><option value="cancelled">cancelled</option></select>
          <button disabled={saving} className="rounded-lg bg-[var(--mikke-accent)] px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{saving ? "保存中..." : "保存"}</button>
        </form>
      ) : null}
    </article>
  );
}

function OwnerResourceManager({ data, onReload, onMessage, onError }: { data: CommunityDashboard; onReload: () => Promise<void>; onMessage: (message: string) => void; onError: (message: string) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<CommunityResourceKind>("web");
  const [externalUrl, setExternalUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await createCommunityResource(supabase, data.community.id, { title, description, kind, externalUrl });
      setTitle("");
      setDescription("");
      setExternalUrl("");
      onMessage("資料リンクを追加しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "資料リンクを追加できませんでした。"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-[var(--mikke-line)] bg-white p-5">
      <h3 className="text-base font-bold tracking-normal">資料リンクを追加</h3>
      <form onSubmit={submit} className="mt-4 grid gap-3 lg:grid-cols-[1fr_160px_1fr_auto]">
        <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="タイトル" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
        <select value={kind} onChange={(event) => setKind(event.target.value as CommunityResourceKind)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm"><option value="web">Web</option><option value="pdf">PDF</option><option value="video">Video</option><option value="other">Other</option></select>
        <input required type="url" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="URL" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
        <button disabled={saving} className="rounded-lg bg-[var(--mikke-accent)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">追加</button>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="説明" rows={2} className="lg:col-span-4 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm leading-6" />
      </form>
      <div className="mt-5 grid gap-2 md:grid-cols-2">
        {data.resources.map((resource) => <OwnerResourceRow key={resource.id} resource={resource} onReload={onReload} onMessage={onMessage} onError={onError} />)}
        {data.resources.length === 0 ? <MikkeEmptyState title="資料リンクはまだありません" helper="説明ページ、PDF、動画などのURLを追加できます。" /> : null}
      </div>
    </section>
  );
}

function OwnerResourceRow({ resource, onReload, onMessage, onError }: { resource: CommunityResource; onReload: () => Promise<void>; onMessage: (message: string) => void; onError: (message: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(resource.title);
  const [description, setDescription] = useState(resource.description ?? "");
  const [kind, setKind] = useState(resource.kind);
  const [externalUrl, setExternalUrl] = useState(resource.externalUrl);
  const [isPublished, setIsPublished] = useState(resource.isPublished);
  const [saving, setSaving] = useState(false);

  async function togglePublish() {
    try {
      await updateCommunityResourceVisibility(supabase, resource.id, !resource.isPublished);
      onMessage(resource.isPublished ? "資料リンクを公開停止しました。" : "資料リンクを再公開しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "資料リンクを更新できませんでした。"));
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await updateCommunityResource(supabase, resource.id, { title, description, kind, externalUrl, isPublished });
      setEditing(false);
      onMessage("資料リンクを保存しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "資料リンクを保存できませんでした。"));
    } finally {
      setSaving(false);
    }
  }
  return (
    <article className="rounded-lg border border-[var(--mikke-line-soft)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm font-bold">{resource.title}</p><p className="text-xs text-[var(--mikke-muted)]">{resource.kind} / {resource.isPublished ? "公開中" : "公開停止"}</p></div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setEditing((value) => !value)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-1.5 text-xs font-bold text-[var(--mikke-primary)]">{editing ? "閉じる" : "編集"}</button>
          <button type="button" onClick={togglePublish} className="rounded-lg border border-[var(--mikke-line)] px-3 py-1.5 text-xs font-bold text-[var(--mikke-danger)]">{resource.isPublished ? "公開停止" : "再公開"}</button>
        </div>
      </div>
      {editing ? (
        <form onSubmit={save} className="mt-3 grid gap-2 border-t border-[var(--mikke-line-soft)] pt-3 md:grid-cols-[1fr_140px]">
          <input required value={title} onChange={(event) => setTitle(event.target.value)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
          <select value={kind} onChange={(event) => setKind(event.target.value as CommunityResourceKind)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm"><option value="web">Web</option><option value="pdf">PDF</option><option value="video">Video</option><option value="other">Other</option></select>
          <input required type="url" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm md:col-span-2" />
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm leading-6 md:col-span-2" />
          <label className="flex items-center gap-2 text-xs font-bold text-[var(--mikke-muted)]"><input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} />公開する</label>
          <button disabled={saving} className="rounded-lg bg-[var(--mikke-accent)] px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{saving ? "保存中..." : "保存"}</button>
        </form>
      ) : null}
    </article>
  );
}

function OwnerSettingsView({ data, userId, ownerLike, onReload, onMessage, onError }: ViewMutationProps & { ownerLike: boolean }) {
  const [name, setName] = useState(data.community.name);
  const [description, setDescription] = useState(data.community.description ?? "");
  const [joinMode, setJoinMode] = useState(data.community.joinMode);
  const [homeMetrics, setHomeMetrics] = useState<[CommunityHomeMetric, CommunityHomeMetric, CommunityHomeMetric]>(data.community.homeMetrics);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [businessName, setBusinessName] = useState(data.operatorProfile?.businessName ?? "");
  const [representativeName, setRepresentativeName] = useState(data.operatorProfile?.representativeName ?? "");
  const [businessType, setBusinessType] = useState(data.operatorProfile?.businessType ?? "individual");
  const [postalAddress, setPostalAddress] = useState(data.operatorProfile?.postalAddress ?? "");
  const [contactEmail, setContactEmail] = useState(data.operatorProfile?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(data.operatorProfile?.contactPhone ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(data.operatorProfile?.websiteUrl ?? "");
  const [commercialDisclosureUrl, setCommercialDisclosureUrl] = useState(data.operatorProfile?.commercialDisclosureUrl ?? "");
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState(data.operatorProfile?.privacyPolicyUrl ?? "");
  const [termsUrl, setTermsUrl] = useState(data.operatorProfile?.termsUrl ?? "");
  const [saving, setSaving] = useState(false);

  async function claim() {
    setSaving(true);
    try {
      await claimCommunityOwnership(supabase, data.community.id, userId);
      onMessage("このCommunityのownerになりました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "owner設定に失敗しました。"));
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (new Set(homeMetrics).size !== 3) {
      onError("HOMEに表示する3つの数字は、それぞれ別の項目を選んでください。");
      return;
    }
    setSaving(true);
    try {
      const [logo, banner] = await Promise.all([
        logoFile ? uploadMikkeMediaImage({ userId, file: logoFile, sourceApp: "community-logo" }) : null,
        bannerFile ? uploadMikkeMediaImage({ userId, file: bannerFile, sourceApp: "community-banner" }) : null
      ]);
      await saveCommunitySettings(supabase, data.community.id, { name, description, joinMode, homeMetrics, logoUrl: logo?.publicUrl, bannerUrl: banner?.publicUrl });
      if (logo) await syncMikkeMediaUsages({ appKey: "community", entityType: "community-logo", entityId: data.community.id, assetIds: [logo.id] });
      if (banner) await syncMikkeMediaUsages({ appKey: "community", entityType: "community-banner", entityId: data.community.id, assetIds: [banner.id] });
      setLogoFile(null);
      setBannerFile(null);
      onMessage("Community設定を保存しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "Community設定を保存できませんでした。"));
    } finally {
      setSaving(false);
    }
  }

  async function submitOperator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveCommunityOperatorProfile(supabase, data.community.id, {
        businessName, representativeName, businessType, postalAddress, contactEmail,
        contactPhone, websiteUrl, commercialDisclosureUrl, privacyPolicyUrl, termsUrl
      });
      onMessage("運営者・契約情報を保存しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "運営者情報を保存できませんでした。"));
    } finally {
      setSaving(false);
    }
  }

  if (!ownerLike && data.community.ownerUserId) return <MikkeEmptyState title="owner権限が必要です" helper="Communityの基本設定はownerだけが変更できます。" />;
  if (!ownerLike) {
    return (
      <section className="max-w-2xl border-t border-[var(--mikke-line)] pt-5">
        <MikkeEmptyState title="このCommunityにはownerが未設定です" helper="最初の運営者として、このCommunityのownerを引き受けられます。" />
        <button type="button" disabled={saving} onClick={claim} className="mt-4 rounded-lg bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">ownerになる</button>
      </section>
    );
  }
  return (
    <section className="max-w-3xl space-y-6 border-t border-[var(--mikke-line)] pt-5">
    <form onSubmit={submit} className="rounded-lg border border-[var(--mikke-line)] bg-white p-5">
      <h2 className="text-2xl font-bold tracking-normal">COMMUNITY SETTINGS</h2>
      <label className="mt-4 block"><span className="text-sm font-bold">Community名</span><input required value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] px-4 py-3" /></label>
      <label className="mt-4 block"><span className="text-sm font-bold">説明</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] px-4 py-3 leading-6" /></label>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><ImageFilePicker label="ブランドロゴ" file={logoFile} onChange={setLogoFile} /><ImageFilePicker label="ブランドバナー" file={bannerFile} onChange={setBannerFile} /></div>
      <label className="mt-4 block"><span className="text-sm font-bold">参加方式</span><select value={joinMode} onChange={(event) => setJoinMode(event.target.value as typeof joinMode)} className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] px-4 py-3"><option value="open_free">無料で自由参加</option><option value="invite_only">招待制</option><option value="paid">有料申込制（決済接続後）</option></select></label>
      <fieldset className="mt-5 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4"><legend className="px-2 text-sm font-bold">HOMEに表示する3つの数字</legend><p className="mb-3 text-xs leading-5 text-[var(--mikke-muted)]">Communityの特徴に合う数字を3つ選べます。同じ項目は重複できません。</p><div className="grid gap-3 sm:grid-cols-3">{homeMetrics.map((metric, index) => <label key={index} className="block"><span className="text-xs font-bold text-[var(--mikke-muted)]">{index + 1}番目</span><select value={metric} onChange={(event) => setHomeMetrics((current) => { const next = [...current] as [CommunityHomeMetric, CommunityHomeMetric, CommunityHomeMetric]; next[index] = event.target.value as CommunityHomeMetric; return next; })} className="mt-1 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm"><option value="unread">未読</option><option value="today_activity">今日の動き</option><option value="upcoming_events">開催予定</option><option value="rooms">Room数</option><option value="posts">投稿数</option><option value="comments">コメント数</option><option value="chat_messages">チャット数</option><option value="resources">公開資料数</option></select></label>)}</div></fieldset>
      <button disabled={saving} className="mt-5 rounded-lg bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? "保存中..." : "設定を保存"}</button>
    </form>
    <form onSubmit={submitOperator} className="rounded-lg border border-[var(--mikke-line)] bg-white p-5">
      <p className="text-xs font-bold text-[var(--mikke-muted-light)]">OPERATOR</p>
      <h3 className="mt-1 text-xl font-bold">運営者・契約情報</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">一般販売、有料会員募集、問い合わせ対応に必要な情報です。個人・法人どちらでも登録できます。住所等はこの段階では参加者へ自動公開しません。</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <select value={businessType} onChange={(event) => setBusinessType(event.target.value as typeof businessType)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2"><option value="individual">個人</option><option value="sole_proprietor">個人事業主</option><option value="corporation">法人</option><option value="organization">任意団体</option></select>
        <input required value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="法人名・屋号・団体名" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2" />
        <input required value={representativeName} onChange={(event) => setRepresentativeName(event.target.value)} placeholder="代表者名" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2" />
        <input required type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="問い合わせ先メール" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2" />
        <input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="問い合わせ先電話" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2" />
        <input required value={postalAddress} onChange={(event) => setPostalAddress(event.target.value)} placeholder="所在地" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2" />
        <input type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="WebサイトURL" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 sm:col-span-2" />
        <input type="url" value={commercialDisclosureUrl} onChange={(event) => setCommercialDisclosureUrl(event.target.value)} placeholder="特定商取引法に基づく表記URL" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 sm:col-span-2" />
        <input type="url" value={privacyPolicyUrl} onChange={(event) => setPrivacyPolicyUrl(event.target.value)} placeholder="プライバシーポリシーURL" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 sm:col-span-2" />
        <input type="url" value={termsUrl} onChange={(event) => setTermsUrl(event.target.value)} placeholder="利用規約URL" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 sm:col-span-2" />
      </div>
      <button disabled={saving} className="mt-4 rounded-lg bg-[var(--mikke-primary)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">運営者情報を保存</button>
    </form>
    </section>
  );
}

function OwnerRoomsView({ data, ownerLike, onReload, onMessage, onError }: ViewMutationProps & { ownerLike: boolean }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<CommunityRoomKind>("normal");
  const [conversationMode, setConversationMode] = useState<CommunityConversationMode>("thread");
  const [accessType, setAccessType] = useState<CommunityRoomAccessType>("free");
  const [themeColor, setThemeColor] = useState<CommunityRoomColor>("yellow");
  const [entitlementKey, setEntitlementKey] = useState(data.entitlementDefinitions[0]?.key ?? "");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const activeRooms = data.rooms.filter((room) => !room.isArchived);
  const archivedRooms = data.rooms.filter((room) => room.isArchived);

  async function moveRoom(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= activeRooms.length) return;
    const roomIds = activeRooms.map((room) => room.id);
    [roomIds[index], roomIds[targetIndex]] = [roomIds[targetIndex], roomIds[index]];
    setSaving(true);
    try {
      await reorderCommunityRooms(supabase, data.community.id, roomIds);
      onMessage("Roomの順番を更新しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "Roomの順番を更新できませんでした。"));
    } finally {
      setSaving(false);
    }
  }

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    setSaving(true);
    try {
      await createCommunityRoom(supabase, data.community.id, { title, description, kind, conversationMode, accessType, themeColor, entitlementKey });
      setTitle("");
      setDescription("");
      onMessage("Roomを作成しました。");
      await onReload();
    } catch (error) {
      const message = communityErrorMessage(error, "Roomを作成できませんでした。");
      setCreateError(message);
      onError(message);
    } finally {
      setSaving(false);
    }
  }

  if (!ownerLike) return <MikkeEmptyState title="運営権限が必要です" helper="Room設定はownerまたはmoderatorが変更できます。" />;
  return (
    <section className="border-t border-[var(--mikke-line)] pt-5">
      <h2 className="text-2xl font-bold tracking-normal">ROOM ACCESS</h2>
      <div className="mt-5 space-y-3">
        {activeRooms.map((room, index) => <RoomAccessEditor key={room.id} room={room} data={data} onMoveUp={index > 0 ? () => moveRoom(index, -1) : undefined} onMoveDown={index < activeRooms.length - 1 ? () => moveRoom(index, 1) : undefined} onReload={onReload} onMessage={onMessage} onError={onError} />)}
      </div>
      {archivedRooms.length > 0 ? (
        <section className="mt-6 border-t border-[var(--mikke-line-soft)] pt-5">
          <h3 className="text-base font-bold tracking-normal">公開停止中のRoom</h3>
          <div className="mt-3 space-y-3">
            {archivedRooms.map((room) => <RoomAccessEditor key={room.id} room={room} data={data} onReload={onReload} onMessage={onMessage} onError={onError} />)}
          </div>
        </section>
      ) : null}
      <form onSubmit={createRoom} className="mt-6 rounded-lg border border-[var(--mikke-line)] bg-white p-5">
        <h3 className="font-bold">Roomを追加</h3>
        <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Room名" className="mt-3 w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2" />
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="説明" rows={3} className="mt-3 w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2" />
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <select value={kind} onChange={(event) => setKind(event.target.value as CommunityRoomKind)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2"><option value="normal">交流</option><option value="announcement">お知らせ</option><option value="question">質問</option><option value="event">イベント</option></select>
          <ConversationModeSelect value={conversationMode} onChange={setConversationMode} />
          <RoomColorSelect value={themeColor} onChange={setThemeColor} />
          <AccessTypeSelect value={accessType} onChange={setAccessType} />
          {accessType === "entitlement" ? <EntitlementSelect data={data} value={entitlementKey} onChange={setEntitlementKey} /> : <span />}
        </div>
        <button disabled={saving || (accessType === "entitlement" && !entitlementKey)} className="mt-4 rounded-lg bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "作成中..." : "Roomを作成"}</button>
        {createError ? <p role="alert" className="mt-3 text-sm font-bold text-[var(--mikke-danger)]">{createError}</p> : null}
      </form>
    </section>
  );
}

function RoomAccessEditor({ room, data, onMoveUp, onMoveDown, onReload, onMessage, onError }: { room: CommunityRoom; data: CommunityDashboard; onMoveUp?: () => void; onMoveDown?: () => void; onReload: () => Promise<void>; onMessage: (message: string) => void; onError: (message: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(room.title);
  const [description, setDescription] = useState(room.description ?? "");
  const [kind, setKind] = useState(room.kind);
  const [conversationMode, setConversationMode] = useState(room.conversationMode);
  const [themeColor, setThemeColor] = useState(room.themeColor);
  const [memberCanPost, setMemberCanPost] = useState(room.memberCanPost);
  const [memberCanComment, setMemberCanComment] = useState(room.memberCanComment);
  const [accessType, setAccessType] = useState(room.accessType);
  const [entitlementKey, setEntitlementKey] = useState(room.requiredEntitlementKeys[0] ?? data.entitlementDefinitions[0]?.key ?? "");
  const [saving, setSaving] = useState(false);

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await updateCommunityRoom(supabase, room.id, data.community.id, {
        title,
        description,
        kind,
        conversationMode,
        themeColor,
        sortOrder: room.sortOrder,
        memberCanPost,
        memberCanComment
      });
      setEditing(false);
      onMessage(`${room.title} の内容を保存しました。`);
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "Room内容を保存できませんでした。"));
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await updateCommunityRoomAccess(supabase, room.id, data.community.id, accessType, entitlementKey);
      onMessage(`${room.title} の公開範囲を更新しました。`);
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "公開範囲を更新できませんでした。"));
    } finally {
      setSaving(false);
    }
  }
  async function archive() {
    setSaving(true);
    try {
      await archiveCommunityRoom(supabase, room.id, data.community.id);
      onMessage(`${room.title} を公開停止しました。`);
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "Roomを公開停止できませんでした。"));
    } finally {
      setSaving(false);
    }
  }
  async function restore() {
    setSaving(true);
    try {
      await restoreCommunityRoom(supabase, room.id, data.community.id);
      onMessage(`${room.title} を再公開しました。`);
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "Roomを再公開できませんでした。"));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className={`rounded-lg border border-[var(--mikke-line)] bg-white p-4 ${room.isArchived ? "opacity-80" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-start gap-2">{!room.isArchived ? <div className="flex flex-col"><button type="button" disabled={saving || !onMoveUp} onClick={onMoveUp} className="p-1 text-[var(--mikke-primary)] disabled:opacity-20" aria-label={`${room.title}を上へ`}><ChevronUp size={17} /></button><button type="button" disabled={saving || !onMoveDown} onClick={onMoveDown} className="p-1 text-[var(--mikke-primary)] disabled:opacity-20" aria-label={`${room.title}を下へ`}><ChevronDown size={17} /></button></div> : null}<div><p className="font-bold">{room.title}</p><p className="mt-1 text-xs text-[var(--mikke-muted)]">{room.description}</p></div></div><div className="flex flex-wrap gap-2"><RoomAccessBadge room={room} />{room.isArchived ? <MikkeStatusBadge tone="muted">公開停止</MikkeStatusBadge> : null}</div></div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto_auto_auto]">
        <AccessTypeSelect value={accessType} onChange={setAccessType} />
        {accessType === "entitlement" ? <EntitlementSelect data={data} value={entitlementKey} onChange={setEntitlementKey} /> : <span />}
        <button type="button" disabled={saving} onClick={() => setEditing((value) => !value)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm font-bold text-[var(--mikke-primary)] disabled:opacity-60">{editing ? "閉じる" : "編集"}</button>
        <button type="button" disabled={saving || (accessType === "entitlement" && !entitlementKey)} onClick={save} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm font-bold text-[var(--mikke-primary)] disabled:opacity-60">保存</button>
        <button type="button" disabled={saving} onClick={room.isArchived ? restore : archive} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm font-bold text-[var(--mikke-danger)] disabled:opacity-60">{room.isArchived ? "再公開" : "公開停止"}</button>
      </div>
      {editing ? (
        <form onSubmit={saveDetails} className="mt-3 grid gap-3 border-t border-[var(--mikke-line-soft)] pt-3 md:grid-cols-2 xl:grid-cols-[1fr_160px_160px_160px]">
          <input required value={title} onChange={(event) => setTitle(event.target.value)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
          <select value={kind} onChange={(event) => setKind(event.target.value as CommunityRoomKind)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm"><option value="normal">交流</option><option value="announcement">お知らせ</option><option value="question">質問</option><option value="event">イベント</option></select>
          <ConversationModeSelect value={conversationMode} onChange={setConversationMode} />
          <RoomColorSelect value={themeColor} onChange={setThemeColor} />
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm leading-6 md:col-span-2 xl:col-span-4" />
          <label className="flex items-center gap-2 text-xs font-bold text-[var(--mikke-muted)]"><input type="checkbox" checked={memberCanPost} onChange={(event) => setMemberCanPost(event.target.checked)} />参加者が投稿できる</label>
          <label className="flex items-center gap-2 text-xs font-bold text-[var(--mikke-muted)]"><input type="checkbox" checked={memberCanComment} onChange={(event) => setMemberCanComment(event.target.checked)} />参加者がコメントできる</label>
          <button disabled={saving} className="rounded-lg bg-[var(--mikke-accent)] px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{saving ? "保存中..." : "Room内容を保存"}</button>
        </form>
      ) : null}
    </div>
  );
}

function AccessTypeSelect({ value, onChange }: { value: CommunityRoomAccessType; onChange: (value: CommunityRoomAccessType) => void }) {
  return <select value={value} onChange={(event) => onChange(event.target.value as CommunityRoomAccessType)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2"><option value="free">無料参加者</option><option value="entitlement">利用権限あり</option><option value="staff">運営限定</option></select>;
}

function EntitlementSelect({ data, value, onChange }: { data: CommunityDashboard; value: string; onChange: (value: string) => void }) {
  return <select required value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2"><option value="">利用権限を選択</option>{data.entitlementDefinitions.map((item) => <option key={item.key} value={item.key}>{item.name} ({item.key})</option>)}</select>;
}

function OwnerMembersView({ data, userId, ownerLike, onReload, onMessage, onError }: ViewMutationProps & { ownerLike: boolean }) {
  const [keyName, setKeyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteMikkeId, setInviteMikkeId] = useState("");
  const [inviteEntitlement, setInviteEntitlement] = useState("");
  const [planName, setPlanName] = useState("");
  const [planDescription, setPlanDescription] = useState("");
  const [planEntitlement, setPlanEntitlement] = useState(data.entitlementDefinitions[0]?.key ?? "");
  const [planAmount, setPlanAmount] = useState("1000");
  const [planInterval, setPlanInterval] = useState<"month" | "year" | "one_time">("month");
  const [paymentProvider, setPaymentProvider] = useState("Stripe");
  const [paymentUrl, setPaymentUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const inviteUrl = `https://mikke-os.com/community/c/${data.community.slug}`;
  async function createDefinition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await createEntitlementDefinition(supabase, data.community.id, { key: keyName, name: displayName });
      setKeyName("");
      setDisplayName("");
      onMessage("利用権限を作成しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "利用権限を作成できませんでした。"));
    } finally {
      setSaving(false);
    }
  }

  async function inviteByMikkeId(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await inviteCommunityMemberByMikkeId(supabase, data.community.id, inviteMikkeId, inviteEntitlement || undefined);
      setInviteMikkeId("");
      onMessage("mikke IDへ招待を登録しました。参加者は招待URLから規約同意と参加登録を行います。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "mikke IDで招待できませんでした。"));
    } finally {
      setSaving(false);
    }
  }
  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await createCommunityMembershipPlan(supabase, data.community.id, userId, {
        entitlementKey: planEntitlement, name: planName, description: planDescription,
        amountYen: Number(planAmount), billingInterval: planInterval,
        paymentProviderLabel: paymentProvider, externalPaymentUrl: paymentUrl, status: "active"
      });
      setPlanName(""); setPlanDescription(""); setPaymentUrl("");
      onMessage("有料会員プランを公開しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "有料会員プランを作成できませんでした。"));
    } finally {
      setSaving(false);
    }
  }
  async function reviewClaim(claimId: string, approved: boolean) {
    setSaving(true);
    try {
      await reviewCommunityPaymentClaim(supabase, claimId, userId, approved);
      onMessage(approved ? "支払いを承認し、利用権限を付与しました。" : "支払い申請を却下しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "支払い申請を更新できませんでした。"));
    } finally {
      setSaving(false);
    }
  }
  if (!ownerLike) return <MikkeEmptyState title="運営権限が必要です" helper="参加者と利用権限はownerまたはmoderatorが管理できます。" />;
  return (
    <section className="border-t border-[var(--mikke-line)] pt-5">
      <h2 className="text-2xl font-bold tracking-normal">MEMBERS & ACCESS</h2>
      <section className="mt-4 rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4">
        <p className="text-sm font-bold">参加者用の招待URL</p>
        <p className="mt-2 break-all rounded-lg bg-white px-3 py-2 text-sm text-[var(--mikke-primary)]">{inviteUrl}</p>
        <button type="button" onClick={async () => { await navigator.clipboard.writeText(inviteUrl); onMessage("招待URLをコピーしました。"); }} className="mt-2 rounded-lg border border-[var(--mikke-line)] bg-white px-4 py-2 text-xs font-bold text-[var(--mikke-primary)]">URLをコピー</button>
        <p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]">このURLを参加者へ渡してください。登録・規約同意・参加申請を通るため、URLだけで権限が付くことはありません。</p>
      </section>
      <form onSubmit={inviteByMikkeId} className="mt-4 grid gap-3 rounded-lg border border-[var(--mikke-line)] bg-white p-4 md:grid-cols-[1fr_1fr_auto]">
        <div className="md:col-span-3"><p className="font-bold">mikke IDで招待</p><p className="mt-1 text-xs text-[var(--mikke-muted)]">メールアドレスは表示しません。招待された本人が上のURLから参加手続きを完了します。</p></div>
        <input required value={inviteMikkeId} onChange={(event) => setInviteMikkeId(event.target.value)} placeholder="@mikke-id" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2" />
        <select value={inviteEntitlement} onChange={(event) => setInviteEntitlement(event.target.value)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2"><option value="">参加のみ（追加権限なし）</option>{data.entitlementDefinitions.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select>
        <button disabled={saving} className="rounded-lg bg-[var(--mikke-primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">招待する</button>
        {data.invitations.length > 0 ? <div className="md:col-span-3 flex flex-wrap gap-2">{data.invitations.map((invitation) => <span key={invitation.id} className="rounded-full bg-[var(--mikke-surface-soft)] px-3 py-1 text-xs font-bold">@{invitation.invitedMikkeId} / {invitation.status}</span>)}</div> : null}
      </form>
      <form onSubmit={createDefinition} className="mt-4 grid gap-3 rounded-lg border border-[var(--mikke-line)] bg-white p-4 md:grid-cols-[1fr_1fr_auto]">
        <div className="md:col-span-3"><p className="font-bold">利用権限ランク</p><p className="mt-1 text-xs text-[var(--mikke-muted)]">Roomの公開範囲、有料プラン、Academy等の外部会員資格を同じ権限キーで結びます。</p></div>
        <input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="表示名 例: プレミアム" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2" />
        <input required value={keyName} onChange={(event) => setKeyName(event.target.value)} placeholder="キー 例: paid:premium" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2" />
        <button disabled={saving} className="rounded-lg bg-[var(--mikke-accent)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">権限を追加</button>
      </form>
      <form onSubmit={createPlan} className="mt-4 grid gap-3 rounded-lg border border-[var(--mikke-line)] bg-white p-4 md:grid-cols-2">
        <div className="md:col-span-2"><p className="font-bold">参加者向け有料会員プラン</p><p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">運営本部が契約するStripe・Square・STORES等の決済URLを使います。mikkeへのCommunityアプリ利用料とは別です。</p></div>
        <input required value={planName} onChange={(event) => setPlanName(event.target.value)} placeholder="プラン名" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2" />
        <EntitlementSelect data={data} value={planEntitlement} onChange={setPlanEntitlement} />
        <textarea value={planDescription} onChange={(event) => setPlanDescription(event.target.value)} placeholder="内容・特典" rows={3} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 md:col-span-2" />
        <input required min="0" type="number" value={planAmount} onChange={(event) => setPlanAmount(event.target.value)} placeholder="金額（円）" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2" />
        <select value={planInterval} onChange={(event) => setPlanInterval(event.target.value as typeof planInterval)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2"><option value="month">月額</option><option value="year">年額</option><option value="one_time">1回</option></select>
        <input required value={paymentProvider} onChange={(event) => setPaymentProvider(event.target.value)} placeholder="決済サービス名" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2" />
        <input required type="url" value={paymentUrl} onChange={(event) => setPaymentUrl(event.target.value)} placeholder="https:// 決済URL" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2" />
        <button disabled={saving || !planEntitlement} className="rounded-lg bg-[var(--mikke-accent)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60 md:col-span-2">有料プランを公開</button>
        {data.membershipPlans.length > 0 ? <div className="md:col-span-2 space-y-2">{data.membershipPlans.map((plan) => <p key={plan.id} className="text-sm"><b>{plan.name}</b> ¥{plan.amountYen.toLocaleString()} / {plan.billingInterval} → {plan.entitlementKey}（{plan.status}）</p>)}</div> : null}
      </form>
      {data.paymentClaims.some((claim) => claim.status === "pending") ? <section className="mt-4 rounded-lg border border-[var(--mikke-line)] bg-white p-4"><h3 className="font-bold">支払い確認待ち</h3><div className="mt-3 space-y-3">{data.paymentClaims.filter((claim) => claim.status === "pending").map((claim) => { const member = data.ownerMembers.find((item) => item.membership.userId === claim.userId); const plan = data.membershipPlans.find((item) => item.id === claim.planId); return <div key={claim.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--mikke-surface-soft)] p-3"><div><p className="text-sm font-bold">{member?.profile?.displayName ?? claim.payerName} / {plan?.name ?? "有料プラン"}</p><p className="text-xs text-[var(--mikke-muted)]">名義: {claim.payerName}{claim.externalReference ? ` / 番号: ${claim.externalReference}` : ""}</p></div><div className="flex gap-2"><button type="button" disabled={saving} onClick={() => reviewClaim(claim.id, true)} className="rounded-lg bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white">承認</button><button type="button" disabled={saving} onClick={() => reviewClaim(claim.id, false)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-danger)]">却下</button></div></div>; })}</div></section> : null}
      <div className="mt-5 space-y-3">
        {data.ownerMembers.map((member) => <MemberAccessEditor key={member.membership.id} data={data} member={member} operatorUserId={userId} onReload={onReload} onMessage={onMessage} onError={onError} />)}
        {data.ownerMembers.length === 0 ? <MikkeEmptyState title="参加者はまだいません" helper="無料登録した参加者がここに表示されます。" /> : null}
      </div>
    </section>
  );
}

function MemberAccessEditor({ data, member, operatorUserId, onReload, onMessage, onError }: { data: CommunityDashboard; member: CommunityDashboard["ownerMembers"][number]; operatorUserId: string; onReload: () => Promise<void>; onMessage: (message: string) => void; onError: (message: string) => void }) {
  const [keyName, setKeyName] = useState(data.entitlementDefinitions[0]?.key ?? "");
  const [role, setRole] = useState(member.membership.role);
  const [savingMembership, setSavingMembership] = useState(false);
  const active = member.entitlements.filter(isEffectiveEntitlement);
  const isSelf = member.membership.userId === operatorUserId;
  const isCanonicalOwner = member.membership.userId === data.community.ownerUserId;
  const operatorIsCanonicalOwner = operatorUserId === data.community.ownerUserId;
  async function grant() {
    if (!keyName) return;
    try {
      await grantMemberEntitlement(supabase, data.community.id, member.membership.userId, keyName, operatorUserId);
      onMessage("利用権限を付与しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "利用権限を付与できませんでした。"));
    }
  }
  async function revoke(id: string) {
    try {
      await revokeMemberEntitlement(supabase, id);
      onMessage("利用権限を停止しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "利用権限を停止できませんでした。"));
    }
  }
  async function saveMembership(nextStatus = member.membership.status) {
    setSavingMembership(true);
    try {
      await updateCommunityMembership(supabase, member.membership.id, { role, status: nextStatus });
      onMessage("参加者設定を更新しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "参加者設定を更新できませんでした。"));
    } finally {
      setSavingMembership(false);
    }
  }
  return (
    <article className="rounded-lg border border-[var(--mikke-line)] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold">{member.profile?.displayName ?? "参加者"}</p><p className="text-xs text-[var(--mikke-muted)]">{member.membership.role} / {member.membership.status}</p></div><div className="flex flex-wrap gap-2">{active.map((item) => item.source !== "academy_subscription" ? <button key={item.id} type="button" onClick={() => revoke(item.id)} className="rounded-full border border-[var(--mikke-line)] px-3 py-1 text-xs font-bold text-[var(--mikke-primary)]">{item.entitlementKey} ・ {entitlementSourceLabel(item.source)} ×</button> : <span key={item.id} className="rounded-full border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-3 py-1 text-xs font-bold text-[var(--mikke-primary)]">{item.entitlementKey} ・ {entitlementSourceLabel(item.source)}</span>)}</div></div>
      <div className="mt-3 grid gap-2 md:grid-cols-[160px_auto_auto]">
        <select value={isCanonicalOwner ? "owner" : role} disabled={isCanonicalOwner || !operatorIsCanonicalOwner} onChange={(event) => setRole(event.target.value as typeof role)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm disabled:bg-[var(--mikke-surface-soft)] disabled:text-[var(--mikke-muted)]">
          <option value="member">参加者</option>
          <option value="moderator">モデレーター（共同運営）</option>
          {isCanonicalOwner ? <option value="owner">オーナー</option> : null}
        </select>
        <button type="button" disabled={savingMembership || isCanonicalOwner || !operatorIsCanonicalOwner} onClick={() => saveMembership()} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-primary)] disabled:opacity-60">役割を保存</button>
        <button type="button" disabled={savingMembership || isSelf || isCanonicalOwner} onClick={() => saveMembership(member.membership.status === "suspended" ? "active" : "suspended")} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-danger)] disabled:opacity-60">{isCanonicalOwner ? "オーナーは停止不可" : isSelf ? "自分は停止不可" : member.membership.status === "suspended" ? "復帰" : "停止"}</button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><EntitlementSelect data={data} value={keyName} onChange={setKeyName} /><button type="button" disabled={!keyName} onClick={grant} className="rounded-lg bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white disabled:opacity-60">付与</button></div>
    </article>
  );
}

function RoomAccessBadge({ room }: { room: CommunityRoom }) {
  if (room.accessType === "staff") return <MikkeStatusBadge tone="muted">運営限定</MikkeStatusBadge>;
  if (room.accessType === "entitlement") return <MikkeStatusBadge tone="primary">{room.isLocked ? "限定・ロック中" : "限定公開"}</MikkeStatusBadge>;
  return <MikkeStatusBadge tone="success">無料</MikkeStatusBadge>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--mikke-line)] bg-white p-4">
      <p className="text-xs font-bold text-[var(--mikke-muted-light)]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--mikke-primary)]">{value}</p>
    </div>
  );
}

function SidePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--mikke-line)] bg-white p-5">
      <h3 className="text-sm font-bold tracking-normal">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EventMini({ event }: { event: CommunityEvent }) {
  return (
    <div className="border-t border-[var(--mikke-line-soft)] py-3 first:border-t-0">
      <p className="text-sm font-bold">{event.title}</p>
      <p className="mt-1 text-xs font-bold text-[var(--mikke-muted-light)]">{formatDateTime(event.startsAt)}</p>
    </div>
  );
}

type CommunityAuthFormProps = {
  audience: "organizer" | "participant";
  community?: CommunityPublicEntry | null;
  defaultNext: string;
  signupNext?: string;
};

function CommunityAuthForm({ audience, community, defaultNext, signupNext = defaultNext }: CommunityAuthFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "signup") setMode("signup");
  }, []);
  const isOrganizer = audience === "organizer";
  const heading = community ? `${community.name}に参加` : isOrganizer ? "Communityを作る・運営する" : "参加中のCommunityを見る";
  const next = mode === "signup" ? signupNext : defaultNext;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}${next}` } });
    setLoading(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setMessage("確認メールを送りました。メール内のリンクからCommunityに戻ってください。");
      return;
    }
    router.replace(next);
  }

  return (
    <main className="min-h-screen bg-white px-5 py-10 text-[var(--mikke-text)]">
      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[1fr_420px] md:items-center">
        <section>
          <p className="text-xs font-bold text-[var(--mikke-muted-light)]">{community ? "参加者入口" : isOrganizer ? "運営者入口" : "参加者入口"}</p>
          <h1 className="mt-3 text-4xl font-bold tracking-normal text-[var(--mikke-primary)]">{community?.name ?? "COMMUNITY"}</h1>
          <h2 className="mt-3 text-2xl font-bold tracking-normal text-[var(--mikke-primary)]">{heading}</h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--mikke-muted)]">
            {community?.description ?? (isOrganizer
              ? "Communityの作成、参加者への案内、Roomや投稿の管理を行います。"
              : "参加中のCommunityへ、登録したメールアドレスでログインします。初めて参加する場合は、運営者から届いた専用URLを開いてください。")}
          </p>
        </section>
        <form onSubmit={submit} className="rounded-lg border border-[var(--mikke-line)] bg-white p-6">
          <p className="text-sm font-bold text-[var(--mikke-primary)]">{community ? `${community.name} 参加者向け` : isOrganizer ? "Community作成・運営者向け" : "参加者向け"}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">{isOrganizer ? "運営に使うメールアドレスでログインまたは登録してください。" : "参加に使うメールアドレスでログインまたは登録してください。"}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-[var(--mikke-line)] p-1">
            <button type="button" onClick={() => setMode("login")} className={`rounded-md px-3 py-2 text-sm font-bold ${mode === "login" ? "bg-[var(--mikke-yellow)] text-[var(--mikke-primary)]" : "text-[var(--mikke-muted)]"}`}>ログイン</button>
            <button type="button" onClick={() => setMode("signup")} className={`rounded-md px-3 py-2 text-sm font-bold ${mode === "signup" ? "bg-[var(--mikke-yellow)] text-[var(--mikke-primary)]" : "text-[var(--mikke-muted)]"}`}>新規登録</button>
          </div>
          <label className="mt-5 block">
            <span className="text-sm font-bold">メールアドレス</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] px-4 py-3 outline-none focus:border-[var(--mikke-accent)]" />
          </label>
          <label className="mt-4 block">
            <span className="text-sm font-bold">パスワード</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required minLength={6} className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] px-4 py-3 outline-none focus:border-[var(--mikke-accent)]" />
          </label>
          {message ? <p className="mt-4 rounded-lg bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm font-bold text-[var(--mikke-accent-strong)]">{message}</p> : null}
          <button disabled={loading} className="mt-5 w-full rounded-lg bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
            {loading ? "確認中..." : mode === "login" ? (community ? `${community.name}へ進む` : isOrganizer ? "運営画面へ進む" : "参加中のCommunityへ進む") : (community ? "登録して参加へ進む" : isOrganizer ? "運営者アカウントを登録" : "参加者アカウントを登録")}
          </button>
          <p className="mt-5 text-center text-xs text-[var(--mikke-muted-light)]">
            {isOrganizer ? <Link href="/community/participant-login" className="underline">参加者の方はこちら</Link> : <Link href="/community/for-organizers" className="underline">Communityを作る・運営する方はこちら</Link>}
          </p>
        </form>
      </div>
      <p className="mx-auto mt-10 max-w-5xl border-t border-[var(--mikke-line)] pt-5 text-center text-xs font-bold text-[var(--mikke-muted-light)]">Community by mikke</p>
    </main>
  );
}

export function CommunityOrganizerAuthPage() {
  return <CommunityAuthForm audience="organizer" defaultNext="/community/manage" signupNext="/community/create" />;
}

export function CommunityParticipantAuthPage({ communitySlug }: { communitySlug?: string }) {
  const [community, setCommunity] = useState<CommunityPublicEntry | null>(null);
  const [loading, setLoading] = useState(Boolean(communitySlug));
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!communitySlug) return;
    loadCommunityPublicEntry(supabase, communitySlug)
      .then(setCommunity)
      .catch(() => setLoadError("Community情報を読み込めませんでした。URLを確認して、もう一度お試しください。"))
      .finally(() => setLoading(false));
  }, [communitySlug]);

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-white px-5 text-sm font-semibold text-[var(--mikke-muted)]">Communityを読み込んでいます...</main>;
  }

  if (communitySlug && loadError) {
    return (
      <main className="grid min-h-screen place-items-center bg-white px-5 text-[var(--mikke-text)]">
        <section className="w-full max-w-lg rounded-lg border border-[var(--mikke-line)] p-6 text-center">
          <h1 className="text-2xl font-bold text-[var(--mikke-primary)]">Communityを確認できませんでした</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--mikke-muted)]">{loadError}</p>
          <Link href="/community/participant-login" className="mt-5 inline-flex text-sm font-bold text-[var(--mikke-primary)] underline">参加者ログインへ</Link>
        </section>
      </main>
    );
  }

  const next = communitySlug ? `/community/c/${encodeURIComponent(communitySlug)}` : "/community";
  return <CommunityAuthForm audience="participant" community={community} defaultNext={next} />;
}

export function LegacyCommunityAuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawNext = params.get("next") ?? "";
    const mode = params.get("mode") === "signup" ? "?mode=signup" : "";
    const tenantMatch = rawNext.match(/^\/community\/c\/([^/?#]+)/);
    if (tenantMatch) {
      router.replace(`/community/c/${tenantMatch[1]}/login${mode}`);
      return;
    }
    if (rawNext === "/community/create") {
      router.replace(`/community/for-organizers${mode || "?mode=signup"}`);
      return;
    }
    router.replace(`/community/participant-login${mode}`);
  }, [router]);

  return <main className="grid min-h-screen place-items-center bg-white px-5 text-sm font-semibold text-[var(--mikke-muted)]">入口へ移動しています...</main>;
}

function ConversationModeSelect({ value, onChange }: { value: CommunityConversationMode; onChange: (value: CommunityConversationMode) => void }) {
  return <select aria-label="Roomの表示形式" value={value} onChange={(event) => onChange(event.target.value as CommunityConversationMode)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2"><option value="thread">スレッド式</option><option value="chat">チャット式</option></select>;
}

function OwnerStampManager({ data, userId, onReload, onMessage, onError }: ViewMutationProps) {
  const [name, setName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!imageFile) return;
    setSaving(true);
    try {
      const image = await uploadMikkeMediaImage({ userId, file: imageFile, sourceApp: "community-stamp" });
      const stampId = await createCommunityStamp(supabase, { communityId: data.community.id, userId, name, imageUrl: image.publicUrl });
      await syncMikkeMediaUsages({ appKey: "community", entityType: "community-stamp", entityId: stampId, assetIds: [image.id] });
      setName("");
      setImageFile(null);
      onMessage("オリジナルスタンプを登録しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "スタンプを登録できませんでした。"));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(stampId: string, isActive: boolean) {
    try {
      await setCommunityStampActive(supabase, stampId, isActive);
      onMessage(isActive ? "スタンプを表示しました。" : "スタンプを非表示にしました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "スタンプの表示設定を変更できませんでした。"));
    }
  }

  return (
    <section className="rounded-lg border border-[var(--mikke-line)] bg-white p-5">
      <div className="flex items-center gap-2"><Sticker size={19} className="text-[var(--mikke-primary)]" /><h3 className="text-base font-bold tracking-normal">オリジナルスタンプ</h3></div>
      <p className="mt-2 text-xs leading-6 text-[var(--mikke-muted)]">運営者が登録したスタンプを、参加者がコメント欄から送れます。</p>
      <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-end">
        <label><span className="text-xs font-bold">スタンプ名</span><input required maxLength={40} value={name} onChange={(event) => setName(event.target.value)} placeholder="ありがとう" className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" /></label>
        <ImageFilePicker label="スタンプ画像" file={imageFile} onChange={setImageFile} compact />
        <button disabled={saving || !imageFile} className="rounded-lg bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "登録中..." : "登録"}</button>
      </form>
      <div className="mt-5 flex flex-wrap gap-3">
        {data.stamps.map((stamp) => <article key={stamp.id} className={`w-28 rounded-xl border p-3 text-center ${stamp.isActive ? "border-[var(--mikke-line)]" : "border-dashed border-[var(--mikke-muted-light)] opacity-55"}`}><img src={stamp.imageUrl} alt={stamp.name} className="mx-auto h-16 w-16 object-contain" /><p className="mt-2 truncate text-xs font-bold">{stamp.name}</p><button type="button" onClick={() => toggle(stamp.id, !stamp.isActive)} className="mt-2 text-xs font-bold text-[var(--mikke-primary)]">{stamp.isActive ? "非表示" : "再表示"}</button></article>)}
        {data.stamps.length === 0 ? <p className="text-sm text-[var(--mikke-muted)]">まだスタンプはありません。</p> : null}
      </div>
    </section>
  );
}

function RoomColorSelect({ value, onChange }: { value: CommunityRoomColor; onChange: (value: CommunityRoomColor) => void }) {
  return <label className="flex items-center gap-3 rounded-lg border border-[var(--mikke-line)] bg-white px-3"><span className="h-5 w-5 shrink-0 rounded-md border border-black/10 shadow-sm" style={{ background: roomColorValue(value) }} /><select aria-label="Roomカラー" value={value} onChange={(event) => onChange(event.target.value as CommunityRoomColor)} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"><option value="blue">ブルー</option><option value="orange">オレンジ</option><option value="yellow">イエロー</option><option value="pink">ピンク</option><option value="green">グリーン</option></select></label>;
}

function ImageFilePicker({ label, file, onChange, compact = false }: { label: string; file: File | null; onChange: (file: File | null) => void; compact?: boolean }) {
  return (
    <label className={`mt-3 block rounded-lg border border-dashed border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] ${compact ? "px-3 py-2" : "p-3"}`}>
      <span className="block text-xs font-bold text-[var(--mikke-primary)]">{label}</span>
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => onChange(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-xs text-[var(--mikke-muted)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--mikke-yellow)] file:px-3 file:py-2 file:font-bold file:text-[var(--mikke-primary)]" />
      {file ? <span className="mt-2 block truncate text-xs text-[var(--mikke-muted)]">選択中：{file.name}</span> : null}
    </label>
  );
}

function GenericFilePicker({ label, file, onChange }: { label: string; file: File | null; onChange: (file: File | null) => void }) {
  return (
    <label className="mt-3 block rounded-lg border border-dashed border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
      <span className="flex items-center gap-2 text-xs font-bold text-[var(--mikke-primary)]"><Paperclip size={14} /> {label}</span>
      <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,image/jpeg,image/png,image/webp" onChange={(event) => onChange(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-xs text-[var(--mikke-muted)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--mikke-yellow)] file:px-3 file:py-2 file:font-bold file:text-[var(--mikke-primary)]" />
      {file ? <span className="mt-2 block truncate text-xs text-[var(--mikke-muted)]">選択中：{file.name}</span> : null}
    </label>
  );
}

function AttachmentButton({ attachment, onError }: { attachment: NonNullable<CommunityPost["attachments"]>[number]; onError: (message: string) => void }) {
  const [loading, setLoading] = useState(false);
  async function download() {
    setLoading(true);
    try {
      const url = await createCommunityAttachmentDownloadUrl(supabase, attachment.storagePath);
      window.location.assign(url);
    } catch (error) {
      onError(communityErrorMessage(error, "添付ファイルを開けませんでした。"));
    } finally {
      setLoading(false);
    }
  }
  return <button type="button" disabled={loading} onClick={download} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-3 py-2 text-left text-xs font-bold text-[var(--mikke-primary)] disabled:opacity-50"><FileDown size={16} className="shrink-0" /><span className="truncate">{attachment.fileName}</span><span className="shrink-0 font-normal text-[var(--mikke-muted)]">{formatFileSize(attachment.byteSize)}</span></button>;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
