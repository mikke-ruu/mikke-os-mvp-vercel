"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  DoorOpen,
  Home,
  KeyRound,
  Library,
  Lock,
  LogOut,
  MessageCircle,
  MessagesSquare,
  Plus,
  Settings,
  ShieldCheck,
  UserRound,
  Users
} from "lucide-react";
import { MikkeAppShell, type MikkeShellBottomNavItem, type MikkeShellNavItem } from "@/components/mikkeos/MikkeAppShell";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import {
  communityErrorMessage,
  archiveCommunityRoom,
  claimCommunityOwnership,
  createCommunityEvent,
  createCommunityRoom,
  createCommunityComment,
  createCommunityResource,
  createEntitlementDefinition,
  createCommunityPost,
  grantMemberEntitlement,
  joinCommunity,
  loadCommunityDashboard,
  revokeMemberEntitlement,
  restoreCommunityRoom,
  saveCommunitySettings,
  saveCommunityProfile,
  setEventAttendance,
  updateCommunityEvent,
  updateCommunityEventStatus,
  updateCommunityMembership,
  updateCommunityPost,
  updateCommunityPostVisibility,
  updateCommunityResource,
  updateCommunityResourceVisibility,
  updateCommunityRoom,
  updateCommunityRoomAccess
} from "@/lib/community/client";
import type { CommunityDashboard, CommunityEvent, CommunityPost, CommunityResource, CommunityResourceKind, CommunityRoom, CommunityRoomAccessType, CommunityRoomKind } from "@/lib/community/types";
import { supabase } from "@/lib/supabase/client";

type CommunityView = "home" | "join" | "rooms" | "room" | "events" | "library" | "profile" | "owner" | "owner-settings" | "owner-rooms" | "owner-members" | "owner-content";

type SessionUser = {
  id: string;
  email?: string;
};

function buildNavigation(base: string) {
  const navItems: MikkeShellNavItem[] = [
    { label: "HOME", href: base, icon: Home },
    { label: "ROOMS", href: `${base}/rooms`, icon: MessagesSquare, section: "参加する" },
    { label: "EVENTS", href: `${base}/events`, icon: CalendarDays, section: "参加する" },
    { label: "LIBRARY", href: `${base}/library`, icon: Library, section: "見る・残す" },
    { label: "PROFILE", href: `${base}/profile`, icon: UserRound, section: "見る・残す" },
    { label: "OWNER", href: `${base}/owner`, icon: ShieldCheck, section: "運営" }
  ];
  const bottomNavItems: MikkeShellBottomNavItem[] = [
    { label: "HOME", href: base, icon: Home },
    { label: "ROOMS", href: `${base}/rooms`, icon: MessagesSquare },
    { label: "POST", href: `${base}/rooms?compose=1`, icon: Plus, primary: true },
    { label: "EVENTS", href: `${base}/events`, icon: CalendarDays },
    { label: "PROFILE", href: `${base}/profile`, icon: UserRound }
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

export function CommunityApp({ view, roomId, communitySlug }: { view: CommunityView; roomId?: string; communitySlug: string }) {
  const router = useRouter();
  const base = `/community/c/${encodeURIComponent(communitySlug)}`;
  const [user, setUser] = useState<SessionUser | null>(null);
  const [data, setData] = useState<CommunityDashboard | null>(null);
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
      const nextUser = sessionData.session?.user ? { id: sessionData.session.user.id, email: sessionData.session.user.email } : null;
      setUser(nextUser);
      if (!nextUser) {
        setLoading(false);
        router.replace(`/community/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
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

  async function signOut() {
    await supabase.auth.signOut();
    router.replace(`/community/login?next=${encodeURIComponent(base)}`);
  }

  async function handleJoin(displayName: string) {
    if (!user || !data?.community) return;
    setMessage("");
    setError("");
    try {
      await joinCommunity(supabase, data.community.id, user.id, displayName, user.email);
      await reload(user);
      setMessage("COMMUNITYに参加しました。");
      router.replace(base);
    } catch (nextError) {
      setError(communityErrorMessage(nextError, "参加処理に失敗しました。"));
    }
  }

  if (loading) {
    return (
      <CommunityShell base={base} onSignOut={signOut}>
        <p className="text-sm font-semibold text-[var(--mikke-muted)]">COMMUNITYを読み込んでいます...</p>
      </CommunityShell>
    );
  }

  if (error && !data) {
    return (
      <CommunityShell base={base} onSignOut={signOut}>
        <MikkeEmptyState title="COMMUNITYの準備が必要です" helper={error} />
      </CommunityShell>
    );
  }

  if (!data || !user) return null;

  const active = data.membership?.status === "active";
  const ownerLike = isOwnerLike(data, user.id);

  if (!active || view === "join") {
    return (
      <CommunityShell base={base} community={data} onSignOut={signOut}>
        <JoinPanel community={data} defaultName={data.profile?.displayName ?? user.email?.split("@")[0] ?? ""} error={error} onJoin={handleJoin} />
      </CommunityShell>
    );
  }

  return (
    <CommunityShell base={base} community={data} onSignOut={signOut}>
      {message ? <Notice>{message}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}
      {view === "home" ? <HomeView base={base} data={data} userId={user.id} onReload={() => reload(user)} onMessage={setMessage} onError={setError} /> : null}
      {view === "rooms" ? <RoomsView base={base} data={data} /> : null}
      {view === "room" ? <RoomView data={data} userId={user.id} roomId={roomId} onReload={() => reload(user)} onMessage={setMessage} onError={setError} /> : null}
      {view === "events" ? <EventsView events={data.events} userId={user.id} onReload={() => reload(user)} onMessage={setMessage} onError={setError} /> : null}
      {view === "library" ? <LibraryView data={data} /> : null}
      {view === "profile" ? <ProfileView data={data} userId={user.id} onReload={() => reload(user)} onMessage={setMessage} onError={setError} /> : null}
      {view === "owner" ? <OwnerView base={base} data={data} ownerLike={ownerLike} /> : null}
      {view === "owner-settings" ? <OwnerSettingsView data={data} userId={user.id} ownerLike={ownerLike} onReload={() => reload(user)} onMessage={setMessage} onError={setError} /> : null}
      {view === "owner-rooms" ? <OwnerRoomsView data={data} userId={user.id} ownerLike={ownerLike} onReload={() => reload(user)} onMessage={setMessage} onError={setError} /> : null}
      {view === "owner-members" ? <OwnerMembersView data={data} userId={user.id} ownerLike={ownerLike} onReload={() => reload(user)} onMessage={setMessage} onError={setError} /> : null}
      {view === "owner-content" ? <OwnerContentView data={data} userId={user.id} ownerLike={ownerLike} onReload={() => reload(user)} onMessage={setMessage} onError={setError} /> : null}
    </CommunityShell>
  );
}

function CommunityShell({ children, base, community, onSignOut }: { children: React.ReactNode; base: string; community?: CommunityDashboard | null; onSignOut: () => void }) {
  const { navItems, bottomNavItems } = buildNavigation(base);
  return (
    <MikkeAppShell
      appName="COMMUNITY"
      title={community?.community.name ?? "mikke COMMUNITY"}
      subtitle={community?.community.description ?? "無料エリアと限定エリアを運営できるCommunityアプリ"}
      currentApp={{ label: "COMMUNITY", href: base, icon: Users }}
      theme="yellow"
      navItems={navItems}
      bottomNavItems={bottomNavItems}
      ownedApps={[]}
      otherApps={[]}
      suggestedApps={[]}
      footerLabel="Community by mikke"
      sidebarFooterAction={{ label: "ログアウト", helper: "COMMUNITYから退出", icon: LogOut, onClick: onSignOut }}
    >
      {children}
    </MikkeAppShell>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm font-bold text-[var(--mikke-accent-strong)]">{children}</p>;
}

function JoinPanel({ community, defaultName, error, onJoin }: { community: CommunityDashboard; defaultName: string; error: string; onJoin: (displayName: string) => Promise<void> }) {
  const [displayName, setDisplayName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const canSelfJoin = community.community.joinMode === "open_free";
  const joinModeCopy = community.community.joinMode === "invite_only"
    ? { badge: "招待制", title: "このCommunityは招待制です", helper: "運営者から参加権限が付与されると利用できます。" }
    : community.community.joinMode === "paid"
      ? { badge: "有料申込制", title: "このCommunityは有料エリア準備中です", helper: "決済接続後、申込済みメンバーに参加導線を開放します。" }
      : { badge: "無料参加", title: `${community.community.name} に参加`, helper: community.community.description ?? "無料登録すると、このCommunityの無料Roomへ参加できます。" };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSelfJoin) return;
    setSaving(true);
    await onJoin(displayName);
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
        <label className="block">
          <span className="text-sm font-bold text-[var(--mikke-text)]">表示名</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-4 py-3 outline-none focus:border-[var(--mikke-accent)]"
          />
        </label>
        {error ? <p className="mt-3 text-sm font-bold text-[var(--mikke-danger)]">{error}</p> : null}
        <button disabled={saving || !canSelfJoin} className="mt-4 w-full rounded-lg bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
          {saving ? "参加中..." : canSelfJoin ? "無料で参加する" : "現在は参加受付外です"}
        </button>
      </form>
    </section>
  );
}

function HomeView({ base, data, userId, onReload, onMessage, onError }: ViewMutationProps & { base: string }) {
  const visiblePosts = data.posts.filter((post) => !post.isHidden);
  const visibleEvents = data.events.filter((event) => event.status !== "cancelled");
  const visibleResources = data.resources.filter((resource) => resource.isPublished);
  const pinned = visiblePosts.filter((post) => post.isPinned).slice(0, 3);
  const recent = visiblePosts.slice(0, 6);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <section className="border-t border-[var(--mikke-line)] pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-[var(--mikke-muted-light)]">Home</p>
              <h2 className="mt-1 text-2xl font-bold tracking-normal">最新のお知らせ</h2>
            </div>
            <Link href={`${base}/rooms`} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]">
              <DoorOpen size={15} /> Roomへ
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {pinned.length > 0 ? pinned.map((post) => <PostCard key={post.id} post={post} userId={userId} onReload={onReload} onMessage={onMessage} onError={onError} />) : <MikkeEmptyState title="固定のお知らせはまだありません" helper="新アプリリリースや説明会情報をここに固定できます。" />}
          </div>
        </section>
        <section className="border-t border-[var(--mikke-line)] pt-5">
          <h2 className="text-lg font-bold tracking-normal">新着投稿</h2>
          <div className="mt-4 space-y-3">
            {recent.length > 0 ? recent.map((post) => <PostCard key={post.id} post={post} userId={userId} onReload={onReload} onMessage={onMessage} onError={onError} />) : <MikkeEmptyState title="投稿はまだありません" helper="Roomから最初の投稿を作成できます。" />}
          </div>
        </section>
      </div>
      <aside className="space-y-4">
        <SidePanel title="次の予定">
          {visibleEvents.slice(0, 3).map((event) => <EventMini key={event.id} event={event} />)}
          {visibleEvents.length === 0 ? <p className="text-sm text-[var(--mikke-muted)]">予定はまだありません。</p> : null}
        </SidePanel>
        <SidePanel title="資料">
          {visibleResources.slice(0, 4).map((resource) => (
            <a key={resource.id} href={resource.externalUrl} target="_blank" rel="noreferrer" className="block border-t border-[var(--mikke-line-soft)] py-3 text-sm font-bold text-[var(--mikke-primary)] first:border-t-0">
              {resource.title}
            </a>
          ))}
          {visibleResources.length === 0 ? <p className="text-sm text-[var(--mikke-muted)]">資料リンクはまだありません。</p> : null}
        </SidePanel>
      </aside>
    </div>
  );
}

function RoomsView({ base, data }: { base: string; data: CommunityDashboard }) {
  const visibleRooms = data.rooms.filter((room) => !room.isArchived);
  return (
    <section className="border-t border-[var(--mikke-line)] pt-5">
      <h2 className="text-2xl font-bold tracking-normal">ROOMS</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {visibleRooms.map((room) => (
          <Link key={room.id} href={room.isLocked ? `${base}/rooms` : `${base}/rooms/${room.id}`} aria-disabled={room.isLocked} className={`rounded-lg border border-[var(--mikke-line)] bg-white p-5 ${room.isLocked ? "cursor-not-allowed opacity-70" : ""}`}>
            <div className="flex items-center justify-between gap-2">
              <MikkeStatusBadge tone={room.kind === "announcement" ? "primary" : "muted"}>{room.kind}</MikkeStatusBadge>
              <RoomAccessBadge room={room} />
            </div>
            <h3 className="mt-3 text-lg font-bold tracking-normal">{room.title}</h3>
            {room.description ? <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">{room.description}</p> : null}
            {room.isLocked ? <p className="mt-3 flex items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]"><Lock size={14} /> このRoomは利用権限が必要です</p> : null}
          </Link>
        ))}
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
  const visibleRooms = data.rooms.filter((candidate) => !candidate.isArchived);
  const room = visibleRooms.find((candidate) => candidate.id === roomId) ?? visibleRooms[0];
  const posts = room ? data.posts.filter((post) => post.roomId === room.id && !post.isHidden) : [];
  if (!room) return <MikkeEmptyState title="Roomがまだありません" helper="運営画面から最初のRoomを作成してください。" />;
  if (room.isLocked) return <MikkeEmptyState title="このRoomは限定公開です" helper="利用権限が付与されると閲覧できます。運営者へお問い合わせください。" />;
  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="border-t border-[var(--mikke-line)] pt-5">
          <MikkeStatusBadge tone="primary">{room.kind}</MikkeStatusBadge>
          <h2 className="mt-3 text-2xl font-bold tracking-normal">{room.title}</h2>
          {room.description ? <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">{room.description}</p> : null}
        </div>
        <div className="mt-5 space-y-3">
          {posts.length > 0 ? posts.map((post) => <PostCard key={post.id} post={post} userId={userId} onReload={onReload} onMessage={onMessage} onError={onError} />) : <MikkeEmptyState title="このRoomの投稿はまだありません" helper="最初の話題を投稿できます。" />}
        </div>
      </div>
      {room.memberCanPost ? <PostComposer data={data} userId={userId} defaultRoomId={room.id} onReload={onReload} onMessage={onMessage} onError={onError} /> : null}
    </section>
  );
}

function PostComposer({ data, userId, defaultRoomId, onReload, onMessage, onError }: ViewMutationProps & { defaultRoomId?: string }) {
  const [roomId, setRoomId] = useState(defaultRoomId ?? data.rooms.find((room) => !room.isArchived)?.id ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roomId) return;
    setSaving(true);
    try {
      await createCommunityPost(supabase, { communityId: data.community.id, roomId, authorUserId: userId, title, body, kind: "normal", url });
      setTitle("");
      setBody("");
      setUrl("");
      onMessage("投稿しました。");
      await onReload();
    } catch (nextError) {
      onError(communityErrorMessage(nextError, "投稿に失敗しました。"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-[var(--mikke-line)] bg-white p-5">
      <h3 className="text-base font-bold tracking-normal">投稿する</h3>
      <select value={roomId} onChange={(event) => setRoomId(event.target.value)} className="mt-3 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-3 py-2 text-sm">
        {data.rooms.filter((room) => !room.isArchived && room.memberCanPost && !room.isLocked).map((room) => <option key={room.id} value={room.id}>{room.title}</option>)}
      </select>
      <input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="タイトル" className="mt-3 w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm outline-none focus:border-[var(--mikke-accent)]" />
      <textarea value={body} onChange={(event) => setBody(event.target.value)} required rows={5} placeholder="本文" className="mt-3 w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--mikke-accent)]" />
      <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="URL（任意）" className="mt-3 w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm outline-none focus:border-[var(--mikke-accent)]" />
      <button disabled={saving} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
        <Plus size={16} /> {saving ? "投稿中..." : "投稿"}
      </button>
    </form>
  );
}

function PostCard({ post, userId, onReload, onMessage, onError }: { post: CommunityPost; userId: string; onReload: () => Promise<void>; onMessage: (message: string) => void; onError: (message: string) => void }) {
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

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

  return (
    <article className="rounded-lg border border-[var(--mikke-line)] bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        {post.isPinned ? <MikkeStatusBadge tone="primary">固定</MikkeStatusBadge> : null}
        <span className="text-xs font-bold text-[var(--mikke-muted-light)]">{post.room?.title ?? "Room"} ・ {formatDateTime(post.createdAt)}</span>
      </div>
      <h3 className="mt-3 text-lg font-bold tracking-normal">{post.title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--mikke-text-soft)]">{post.body}</p>
      {post.url ? <a href={post.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-bold text-[var(--mikke-primary)]">リンクを開く</a> : null}
      <div className="mt-4 border-t border-[var(--mikke-line-soft)] pt-3">
        {(post.comments ?? []).slice(0, 3).map((item) => (
          <p key={item.id} className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">
            <span className="font-bold text-[var(--mikke-text)]">{item.profile?.displayName ?? "member"}</span> {item.body}
          </p>
        ))}
        <form onSubmit={submit} className="mt-3 flex flex-wrap gap-2">
          <input value={comment} onChange={(event) => setComment(event.target.value)} required placeholder="コメント" className="min-w-0 flex-1 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm outline-none focus:border-[var(--mikke-accent)]" />
          <button disabled={saving} className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--mikke-primary)] text-white disabled:opacity-60" aria-label="コメント">
            <MessageCircle size={16} />
          </button>
        </form>
      </div>
    </article>
  );
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
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveCommunityProfile(supabase, data.community.id, userId, displayName, bio);
      onMessage("プロフィールを保存しました。");
      await onReload();
    } catch (nextError) {
      onError(communityErrorMessage(nextError, "プロフィールを保存できませんでした。"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl border-t border-[var(--mikke-line)] pt-5">
      <h2 className="text-2xl font-bold tracking-normal">PROFILE</h2>
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
          <OwnerLink href={`${base}/owner/rooms`} icon={MessagesSquare} title="Room設定" helper="無料・限定・運営Room" />
          <OwnerLink href={`${base}/owner/members`} icon={KeyRound} title="参加者と権限" helper="手動で利用権限を付与" />
          <OwnerLink href={`${base}/owner/content`} icon={BookOpen} title="コンテンツ管理" helper="告知・イベント・資料" />
        </div>
      ) : null}
      {!ownerLike ? <MikkeEmptyState title="運営操作は owner / moderator のみです" helper="最初の参加者、またはDB上でroleを付与されたユーザーが運営画面を操作できます。" /> : null}
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
          <OwnerResourceManager data={data} onReload={onReload} onMessage={onMessage} onError={onError} />
        </div>
      </div>
    </section>
  );
}

function OwnerPostManager({ data, userId, onReload, onMessage, onError }: ViewMutationProps) {
  const defaultRoomId = data.rooms.find((room) => !room.isArchived && room.kind === "announcement" && !room.isLocked)?.id ?? data.rooms.find((room) => !room.isArchived && !room.isLocked)?.id ?? "";
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
          {data.rooms.filter((room) => !room.isArchived && !room.isLocked).map((room) => <option key={room.id} value={room.id}>{room.title}</option>)}
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
    setSaving(true);
    try {
      await saveCommunitySettings(supabase, data.community.id, { name, description, joinMode });
      onMessage("Community設定を保存しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "Community設定を保存できませんでした。"));
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
    <form onSubmit={submit} className="max-w-2xl border-t border-[var(--mikke-line)] pt-5">
      <h2 className="text-2xl font-bold tracking-normal">COMMUNITY SETTINGS</h2>
      <label className="mt-4 block"><span className="text-sm font-bold">Community名</span><input required value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] px-4 py-3" /></label>
      <label className="mt-4 block"><span className="text-sm font-bold">説明</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] px-4 py-3 leading-6" /></label>
      <label className="mt-4 block"><span className="text-sm font-bold">参加方式</span><select value={joinMode} onChange={(event) => setJoinMode(event.target.value as typeof joinMode)} className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] px-4 py-3"><option value="open_free">無料で自由参加</option><option value="invite_only">招待制</option><option value="paid">有料申込制（決済接続後）</option></select></label>
      <button disabled={saving} className="mt-5 rounded-lg bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? "保存中..." : "設定を保存"}</button>
    </form>
  );
}

function OwnerRoomsView({ data, ownerLike, onReload, onMessage, onError }: ViewMutationProps & { ownerLike: boolean }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<CommunityRoomKind>("normal");
  const [accessType, setAccessType] = useState<CommunityRoomAccessType>("free");
  const [entitlementKey, setEntitlementKey] = useState(data.entitlementDefinitions[0]?.key ?? "");
  const [saving, setSaving] = useState(false);
  const activeRooms = data.rooms.filter((room) => !room.isArchived);
  const archivedRooms = data.rooms.filter((room) => room.isArchived);

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await createCommunityRoom(supabase, data.community.id, { title, description, kind, accessType, entitlementKey });
      setTitle("");
      setDescription("");
      onMessage("Roomを作成しました。");
      await onReload();
    } catch (error) {
      onError(communityErrorMessage(error, "Roomを作成できませんでした。"));
    } finally {
      setSaving(false);
    }
  }

  if (!ownerLike) return <MikkeEmptyState title="運営権限が必要です" helper="Room設定はownerまたはmoderatorが変更できます。" />;
  return (
    <section className="border-t border-[var(--mikke-line)] pt-5">
      <h2 className="text-2xl font-bold tracking-normal">ROOM ACCESS</h2>
      <div className="mt-5 space-y-3">
        {activeRooms.map((room) => <RoomAccessEditor key={room.id} room={room} data={data} onReload={onReload} onMessage={onMessage} onError={onError} />)}
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
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <select value={kind} onChange={(event) => setKind(event.target.value as CommunityRoomKind)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2"><option value="normal">交流</option><option value="announcement">お知らせ</option><option value="question">質問</option><option value="event">イベント</option></select>
          <AccessTypeSelect value={accessType} onChange={setAccessType} />
          {accessType === "entitlement" ? <EntitlementSelect data={data} value={entitlementKey} onChange={setEntitlementKey} /> : <span />}
        </div>
        <button disabled={saving || (accessType === "entitlement" && !entitlementKey)} className="mt-4 rounded-lg bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">Roomを作成</button>
      </form>
    </section>
  );
}

function RoomAccessEditor({ room, data, onReload, onMessage, onError }: { room: CommunityRoom; data: CommunityDashboard; onReload: () => Promise<void>; onMessage: (message: string) => void; onError: (message: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(room.title);
  const [description, setDescription] = useState(room.description ?? "");
  const [kind, setKind] = useState(room.kind);
  const [sortOrder, setSortOrder] = useState(String(room.sortOrder));
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
        sortOrder: Number.parseInt(sortOrder, 10) || 100,
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
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold">{room.title}</p><p className="mt-1 text-xs text-[var(--mikke-muted)]">{room.description}</p></div><div className="flex flex-wrap gap-2"><RoomAccessBadge room={room} />{room.isArchived ? <MikkeStatusBadge tone="muted">公開停止</MikkeStatusBadge> : null}</div></div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto_auto_auto]">
        <AccessTypeSelect value={accessType} onChange={setAccessType} />
        {accessType === "entitlement" ? <EntitlementSelect data={data} value={entitlementKey} onChange={setEntitlementKey} /> : <span />}
        <button type="button" disabled={saving} onClick={() => setEditing((value) => !value)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm font-bold text-[var(--mikke-primary)] disabled:opacity-60">{editing ? "閉じる" : "編集"}</button>
        <button type="button" disabled={saving || (accessType === "entitlement" && !entitlementKey)} onClick={save} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm font-bold text-[var(--mikke-primary)] disabled:opacity-60">保存</button>
        <button type="button" disabled={saving} onClick={room.isArchived ? restore : archive} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm font-bold text-[var(--mikke-danger)] disabled:opacity-60">{room.isArchived ? "再公開" : "公開停止"}</button>
      </div>
      {editing ? (
        <form onSubmit={saveDetails} className="mt-3 grid gap-3 border-t border-[var(--mikke-line-soft)] pt-3 md:grid-cols-[1fr_140px_120px]">
          <input required value={title} onChange={(event) => setTitle(event.target.value)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
          <select value={kind} onChange={(event) => setKind(event.target.value as CommunityRoomKind)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm"><option value="normal">交流</option><option value="announcement">お知らせ</option><option value="question">質問</option><option value="event">イベント</option></select>
          <input type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm leading-6 md:col-span-3" />
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
  const [saving, setSaving] = useState(false);
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
  if (!ownerLike) return <MikkeEmptyState title="運営権限が必要です" helper="参加者と利用権限はownerまたはmoderatorが管理できます。" />;
  return (
    <section className="border-t border-[var(--mikke-line)] pt-5">
      <h2 className="text-2xl font-bold tracking-normal">MEMBERS & ACCESS</h2>
      <form onSubmit={createDefinition} className="mt-4 grid gap-3 rounded-lg border border-[var(--mikke-line)] bg-white p-4 md:grid-cols-[1fr_1fr_auto]">
        <input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="表示名 例: プレミアム" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2" />
        <input required value={keyName} onChange={(event) => setKeyName(event.target.value)} placeholder="キー 例: paid:premium" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2" />
        <button disabled={saving} className="rounded-lg bg-[var(--mikke-accent)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">権限を追加</button>
      </form>
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
  const active = member.entitlements.filter((item) => item.status === "active");
  const isSelf = member.membership.userId === operatorUserId;
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
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold">{member.profile?.displayName ?? "参加者"}</p><p className="text-xs text-[var(--mikke-muted)]">{member.membership.role} / {member.membership.status}</p></div><div className="flex flex-wrap gap-2">{active.map((item) => <button key={item.id} type="button" onClick={() => revoke(item.id)} className="rounded-full border border-[var(--mikke-line)] px-3 py-1 text-xs font-bold text-[var(--mikke-primary)]">{item.entitlementKey} ×</button>)}</div></div>
      <div className="mt-3 grid gap-2 md:grid-cols-[160px_auto_auto]">
        <select value={role} onChange={(event) => setRole(event.target.value as typeof role)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm">
          <option value="member">member</option>
          <option value="moderator">moderator</option>
          <option value="owner">owner</option>
        </select>
        <button type="button" disabled={savingMembership} onClick={() => saveMembership()} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-primary)] disabled:opacity-60">役割を保存</button>
        <button type="button" disabled={savingMembership || isSelf} onClick={() => saveMembership(member.membership.status === "suspended" ? "active" : "suspended")} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-danger)] disabled:opacity-60">{isSelf ? "自分は停止不可" : member.membership.status === "suspended" ? "復帰" : "停止"}</button>
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

function isInAppBrowserUserAgent(userAgent: string) {
  return /Line\//i.test(userAgent) || /Instagram/i.test(userAgent) || /FBAN|FBAV|FB_IAB/i.test(userAgent);
}

function InAppBrowserNotice() {
  const [inAppBrowser, setInAppBrowser] = useState(false);

  useEffect(() => {
    setInAppBrowser(isInAppBrowserUserAgent(navigator.userAgent || ""));
  }, []);

  if (!inAppBrowser) return null;

  return (
    <section className="mb-4 rounded-lg border border-[var(--mikke-accent)] bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm leading-6 text-[var(--mikke-accent-strong)]">
      <p className="font-bold">登録前に、通常ブラウザで開いてください</p>
      <p className="mt-1">
        Instagram・LINE・Facebook内のブラウザでは、確認メール後にログイン状態が引き継がれないことがあります。
      </p>
      <a href="https://mikke-os.com/install.html" className="mt-2 inline-flex font-bold underline">
        ブラウザで開く方法を見る
      </a>
    </section>
  );
}

export function CommunityAuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const next = useMemo(() => {
    if (typeof window === "undefined") return "/community";
    const raw = new URLSearchParams(window.location.search).get("next");
    return raw?.startsWith("/") && !raw.startsWith("//") ? raw : "/community";
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/community/join` } });
    setLoading(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setMessage("確認メールを送りました。メール内のリンクからCOMMUNITYに戻ってください。");
      return;
    }
    router.replace(next);
  }

  return (
    <main className="min-h-screen bg-white px-5 py-10 text-[var(--mikke-text)]">
      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[1fr_420px] md:items-center">
        <section>
          <p className="text-xs font-bold uppercase text-[var(--mikke-primary)]">COMMUNITY</p>
          <h1 className="mt-3 text-4xl font-bold tracking-normal text-[var(--mikke-primary)]">mikke COMMUNITY</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--mikke-muted)]">
            無料エリアと限定エリアを持つCommunityを、単独で利用・運営できます。mikke IDでログインし、参加中のCommunityへ進みます。
          </p>
        </section>
        <form onSubmit={submit} className="rounded-lg border border-[var(--mikke-line)] bg-white p-6">
          <InAppBrowserNotice />
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--mikke-line)] p-1">
            <button type="button" onClick={() => setMode("login")} className={`rounded-md px-3 py-2 text-sm font-bold ${mode === "login" ? "bg-[var(--mikke-yellow)] text-[var(--mikke-primary)]" : "text-[var(--mikke-muted)]"}`}>ログイン</button>
            <button type="button" onClick={() => setMode("signup")} className={`rounded-md px-3 py-2 text-sm font-bold ${mode === "signup" ? "bg-[var(--mikke-yellow)] text-[var(--mikke-primary)]" : "text-[var(--mikke-muted)]"}`}>無料登録</button>
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
            {loading ? "確認中..." : mode === "login" ? "ログイン" : "無料で登録"}
          </button>
          <p className="mt-5 text-center text-xs font-semibold text-[var(--mikke-muted-light)]">Community by mikke</p>
        </form>
      </div>
    </main>
  );
}
