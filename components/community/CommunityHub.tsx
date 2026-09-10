"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { CommunityDirectory } from "./CommunityDirectory";
import { CommunityAuthBoundary, communityScopedClient } from "./CommunityAuthBoundary";
import type { CommunityAuthLease } from "@/lib/community/auth-scope";
import { communityErrorMessage, createCommunity, listMyCommunities, listMyManagedCommunities, listMyPendingCommunityInvitations } from "@/lib/community/client";
import { communityPlatformActionBlock, loadCommunityPlatformStatus, type CommunityPlatformReadState } from "@/lib/community/platform-billing";
import { communityPlatformBrowserTransport } from "@/lib/community/platform-billing-browser";
import { communityBasePath } from "@/lib/community/routes";
import type { Community, CommunityInvitationSummary } from "@/lib/community/types";
import { assertMikkeNameIsNotReserved, isMikkeReservedDisplayName, isMikkeReservedSlug } from "@/lib/mikkeos/reserved-names";
import { supabase } from "@/lib/supabase/client";

type HubUser = { id: string; email?: string };

function HubFrame({ children, organizer = true }: { children: React.ReactNode; organizer?: boolean }) {
  return (
    <main className="min-h-screen bg-white px-5 py-8 text-[var(--mikke-text)]">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-[var(--mikke-line)] pb-5">
          <p className="text-xs font-bold uppercase text-[var(--mikke-primary)]">COMMUNITY</p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal text-[var(--mikke-primary)]">COMMUNITY</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">{organizer ? "同じmikke IDで複数の団体のCommunityを運営できます。開きたいCommunityを選んでください。" : "参加しているCommunityを選んで、お知らせや会話を確認できます。"}</p>
        </header>
        {children}
        <p className="mt-10 border-t border-[var(--mikke-line)] pt-5 text-center text-xs font-bold text-[var(--mikke-muted-light)]">Community by mikke</p>
      </div>
    </main>
  );
}

export function CommunityHubPage({ organizer = false }: { organizer?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<HubUser | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [invitations, setInvitations] = useState<CommunityInvitationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invitationError, setInvitationError] = useState("");

  useEffect(() => {
    let mounted = true;
    let generation = 0;
    let authObserved = false;
    async function load(sessionUser: HubUser | null) {
      const request = ++generation;
      setCommunities([]);
      setInvitations([]);
      setError("");
      setInvitationError("");
      setLoading(true);
      setUser(sessionUser);
      if (!sessionUser) {
        router.replace(organizer ? "/community/for-organizers" : "/community/participant-login");
        return;
      }
      try {
        const [communityResult, invitationResult] = await Promise.allSettled([
          organizer ? listMyManagedCommunities(supabase, sessionUser.id) : listMyCommunities(supabase, sessionUser.id),
          organizer ? Promise.resolve([]) : listMyPendingCommunityInvitations(supabase, sessionUser.id)
        ]);
        if (mounted && request === generation) {
          if (communityResult.status === "fulfilled") setCommunities(communityResult.value);
          else setError(communityErrorMessage(communityResult.reason, "Community一覧を読み込めませんでした。"));
          if (invitationResult.status === "fulfilled") setInvitations(invitationResult.value);
          else setInvitationError("招待一覧を読み込めませんでした。参加済みのCommunity一覧はそのまま利用できます。");
        }
      } catch (nextError) {
        if (mounted && request === generation) setError(communityErrorMessage(nextError, "Community一覧を読み込めませんでした。"));
      } finally {
        if (mounted && request === generation) setLoading(false);
      }
    }
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      authObserved = true;
      // Do not start Supabase queries while the auth callback holds its lock.
      queueMicrotask(() => { if (mounted) void load(session?.user && !session.user.is_anonymous ? session.user : null); });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && !authObserved) void load(data.session?.user && !data.session.user.is_anonymous ? data.session.user : null);
    }).catch(() => { if (mounted && !authObserved) { setError("ログイン状態を確認できませんでした。画面を再読み込みしてください。"); setLoading(false); } });
    return () => { mounted = false; generation++; listener.subscription.unsubscribe(); };
  }, [organizer, router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace(organizer ? "/community/for-organizers" : "/community/participant-login");
  }

  return (
    <HubFrame organizer={organizer}>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold text-[var(--mikke-muted-light)]">MY COMMUNITIES</p>
        <div className="flex gap-2">
          <button type="button" onClick={signOut} className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--mikke-line)] text-[var(--mikke-muted)]" aria-label="ログアウト"><LogOut size={17} /></button>
        </div>
      </div>
      {loading ? <p className="mt-8 text-sm text-[var(--mikke-muted)]">読み込んでいます...</p> : null}
      {error ? <p className="mt-5 rounded-lg bg-[var(--mikke-accent-soft)] p-4 text-sm font-bold text-[var(--mikke-accent-strong)]">{error}</p> : null}
      {invitationError ? <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm font-bold text-amber-800">{invitationError}</p> : null}
      {!organizer && invitations.length > 0 ? <section className="mt-6 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4"><h2 className="font-bold text-[var(--mikke-primary)]">受け取った招待</h2><p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">Community内に届いている招待です。メールや共通通知は自動送信されません。</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{invitations.map((invitation) => <article key={invitation.id} className="rounded-lg border border-[var(--mikke-line-soft)] bg-white p-4"><p className="font-bold">{invitation.community.name}</p><p className="mt-1 text-xs text-[var(--mikke-muted)]">招待状態: 手続き待ち</p><Link href={`/community/c/${invitation.community.slug}/join`} className="mt-3 inline-flex rounded-lg bg-[var(--mikke-primary)] px-4 py-2 text-sm font-bold text-white">招待を確認して参加手続きへ</Link></article>)}</div></section> : null}
      {!loading && !error && user ? <CommunityDirectory communities={communities} organizer={organizer} userId={user.id} /> : null}
    </HubFrame>
  );
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function CommunityCreatePage() {
  return <CommunityAuthBoundary>{(lease) => <CommunityCreateForm key={lease.epoch} lease={lease} />}</CommunityAuthBoundary>;
}

function CommunityCreateForm({ lease }: { lease: CommunityAuthLease }) {
  const router = useRouter();
  const [user, setUser] = useState<HubUser | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [platformState, setPlatformState] = useState<CommunityPlatformReadState>({ kind: "loading" });
  const createBlock = communityPlatformActionBlock(platformState, "create_resource");
  const fieldsDisabled = saving || !user || Boolean(createBlock);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const sessionUser = lease.user;
      if (!sessionUser) {
        router.replace("/community/for-organizers?mode=signup");
        return;
      }
      setUser(sessionUser);
      setDisplayName(sessionUser.email?.split("@")[0] ?? "");
      const state = await loadCommunityPlatformStatus(null, {
        ...communityPlatformBrowserTransport,
        getAccessToken: async () => lease.accessToken()
      }, controller.signal);
      if (lease.isCurrent() && !controller.signal.aborted) setPlatformState(state);
    })().catch(() => { if (lease.isCurrent() && !controller.signal.aborted) setPlatformState({ kind: "error" }); });
    return () => controller.abort();
  }, [router, lease]);

  function updateName(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !lease.isCurrent() || saving) return;
    if (createBlock) {
      setError(createBlock);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const safeSlug = slugify(slug) || `community-${crypto.randomUUID().slice(0, 8)}`;
      assertMikkeNameIsNotReserved({ slug: safeSlug, displayName: name, label: "Community名またはURL用ID" });
      const community = await createCommunity(communityScopedClient(lease), user.id, { name, slug: safeSlug, description, displayName });
      if (!lease.isCurrent()) return;
      router.replace(communityBasePath(community.slug));
    } catch (nextError) {
      if (!lease.isCurrent()) return;
      setError(communityErrorMessage(nextError, "Communityを作成できませんでした。"));
      setSaving(false);
    }
  }

  return (
    <HubFrame>
      <form onSubmit={submit} className="mt-6 max-w-2xl rounded-lg border border-[var(--mikke-line)] bg-white p-5 md:p-6">
        <h2 className="text-xl font-bold">Communityを作る</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">団体の名前を付けて作りましょう。メンバーや投稿はCommunityごとに分かれます。</p>
        {createBlock ? <p id="community-create-block" role="status" aria-live="polite" className="mt-3 rounded-lg border border-[var(--mikke-line)] p-3 text-sm leading-6">{createBlock} <Link href="/community/start" className="font-bold text-[var(--mikke-primary)] underline">利用プラン・契約状態を確認</Link></p> : null}
        <fieldset disabled={fieldsDisabled} aria-describedby={createBlock ? "community-create-block" : undefined} className="contents disabled:opacity-60">
          <label className="mt-5 block"><span className="text-sm font-bold">Community名</span><input required minLength={2} value={name} onChange={(event) => updateName(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] px-4 py-3" /></label>
          <label className="mt-4 block"><span className="text-sm font-bold">URL用ID</span><div className="mt-2 flex rounded-lg border border-[var(--mikke-line)]"><span className="px-3 py-3 text-sm text-[var(--mikke-muted-light)]">/community/c/</span><input required minLength={3} pattern="[a-z0-9][a-z0-9-]{2,59}" value={slug} onChange={(event) => { setSlugTouched(true); setSlug(slugify(event.target.value)); }} className="min-w-0 flex-1 rounded-r-lg px-2 py-3 outline-none" /></div></label>
          {isMikkeReservedSlug(slug) || isMikkeReservedDisplayName(name) ? <p className="mt-2 rounded-lg bg-[var(--mikke-accent-soft)] px-3 py-2 text-xs font-bold text-[var(--mikke-accent-strong)]">mikke / official / admin など公式・運営用の名前は予約されています。一般Communityでは別の名前を使ってください。</p> : null}
          <label className="mt-4 block"><span className="text-sm font-bold">説明</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] px-4 py-3 leading-6" /></label>
          <label className="mt-4 block"><span className="text-sm font-bold">あなたの表示名</span><input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] px-4 py-3" /></label>
        </fieldset>
        {error ? <p className="mt-4 rounded-lg bg-[var(--mikke-accent-soft)] p-3 text-sm font-bold text-[var(--mikke-accent-strong)]">{error}</p> : null}
        <div className="mt-5 flex flex-wrap gap-2"><button disabled={fieldsDisabled} className="rounded-lg bg-[var(--mikke-accent)] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? "作成中..." : "Communityを作成"}</button><Link href="/community/manage" className="rounded-lg border border-[var(--mikke-line)] px-5 py-3 text-sm font-bold text-[var(--mikke-primary)]">運営一覧へ戻る</Link></div>
      </form>
    </HubFrame>
  );
}
