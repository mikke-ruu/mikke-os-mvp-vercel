"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, LogOut, Plus, Users } from "lucide-react";
import { communityErrorMessage, createCommunity, listMyCommunities, listMyManagedCommunities } from "@/lib/community/client";
import { communityPlatformActionBlock, loadCommunityPlatformStatus, type CommunityPlatformReadState } from "@/lib/community/platform-billing";
import { communityPlatformBrowserTransport } from "@/lib/community/platform-billing-browser";
import { communityBasePath } from "@/lib/community/routes";
import type { Community } from "@/lib/community/types";
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
          <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">{organizer ? "無料エリアと限定エリアを持つCommunityを、単独で作成・運営できます。" : "参加中のCommunityから、お知らせ・Room・イベントを確認できます。"}</p>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const sessionUser = data.session?.user ? { id: data.session.user.id, email: data.session.user.email } : null;
      if (!mounted) return;
      if (!sessionUser) {
        router.replace(organizer ? "/community/for-organizers" : "/community/participant-login");
        return;
      }
      setUser(sessionUser);
      try {
        setCommunities(await (organizer ? listMyManagedCommunities(supabase, sessionUser.id) : listMyCommunities(supabase, sessionUser.id)));
      } catch (nextError) {
        setError(communityErrorMessage(nextError, "Community一覧を読み込めませんでした。"));
      } finally {
        if (mounted) setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [organizer, router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace(organizer ? "/community/for-organizers" : "/community/participant-login");
  }

  return (
    <HubFrame organizer={organizer}>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold text-[var(--mikke-muted-light)]">MY COMMUNITIES</p><h2 className="mt-1 text-xl font-bold">{organizer ? "運営中のCommunity" : "参加中のCommunity"}</h2></div>
        <div className="flex gap-2">
          {organizer ? <Link href="/community/start" className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-bold text-white"><Plus size={16} />Communityを始める</Link> : null}
          <button type="button" onClick={signOut} className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--mikke-line)] text-[var(--mikke-muted)]" aria-label="ログアウト"><LogOut size={17} /></button>
        </div>
      </div>
      {loading ? <p className="mt-8 text-sm text-[var(--mikke-muted)]">読み込んでいます...</p> : null}
      {error ? <p className="mt-5 rounded-lg bg-[var(--mikke-accent-soft)] p-4 text-sm font-bold text-[var(--mikke-accent-strong)]">{error}</p> : null}
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {communities.map((community) => (
          <Link key={community.id} href={communityBasePath(community.slug)} className="rounded-lg border border-[var(--mikke-line)] bg-white p-5">
            <div className="flex items-center justify-between gap-3"><Users size={20} className="text-[var(--mikke-primary)]" /><ArrowRight size={17} className="text-[var(--mikke-muted-light)]" /></div>
            <h3 className="mt-3 text-lg font-bold">{community.name}</h3>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--mikke-muted)]">{community.description ?? "説明はまだありません。"}</p>
          </Link>
        ))}
      </div>
      {!loading && user && communities.length === 0 ? (
        <section className="mt-6 rounded-lg border border-dashed border-[var(--mikke-line)] p-6 text-center">
          <h3 className="font-bold">まだCommunityに参加していません</h3>
          <p className="mt-2 text-sm text-[var(--mikke-muted)]">{organizer ? "利用プランと契約状態を確認してから、Communityを作成できます。" : "運営者から受け取った参加URLを開いてください。"}</p>
        </section>
      ) : null}
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

  useEffect(() => {
    const controller = new AbortController();
    supabase.auth.getSession().then(async ({ data }) => {
      const sessionUser = data.session?.user ? { id: data.session.user.id, email: data.session.user.email } : null;
      if (!sessionUser) {
        router.replace("/community/for-organizers?mode=signup");
        return;
      }
      setUser(sessionUser);
      setDisplayName(sessionUser.email?.split("@")[0] ?? "");
      setPlatformState(await loadCommunityPlatformStatus(null, communityPlatformBrowserTransport, controller.signal));
    }).catch(() => setPlatformState({ kind: "error" }));
    return () => controller.abort();
  }, [router]);

  function updateName(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    if (createBlock) {
      setError(createBlock);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const safeSlug = slugify(slug) || `community-${crypto.randomUUID().slice(0, 8)}`;
      assertMikkeNameIsNotReserved({ slug: safeSlug, displayName: name, label: "Community名またはURL用ID" });
      const community = await createCommunity(supabase, user.id, { name, slug: safeSlug, description, displayName });
      router.replace(communityBasePath(community.slug));
    } catch (nextError) {
      setError(communityErrorMessage(nextError, "Communityを作成できませんでした。"));
      setSaving(false);
    }
  }

  return (
    <HubFrame>
      <form onSubmit={submit} className="mt-6 max-w-2xl rounded-lg border border-[var(--mikke-line)] bg-white p-5 md:p-6">
        <h2 className="text-xl font-bold">Communityを作る</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">契約状態と作成権をサーバーで確認し、作成と同じ処理の中で1回だけ消費します。</p>
        {createBlock ? <p className="mt-3 rounded-lg border border-[var(--mikke-line)] p-3 text-sm leading-6">{createBlock} <Link href="/community/start" className="font-bold text-[var(--mikke-primary)] underline">利用プラン・契約状態を確認</Link></p> : null}
        <label className="mt-5 block"><span className="text-sm font-bold">Community名</span><input required minLength={2} value={name} onChange={(event) => updateName(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] px-4 py-3" /></label>
        <label className="mt-4 block"><span className="text-sm font-bold">URL用ID</span><div className="mt-2 flex rounded-lg border border-[var(--mikke-line)]"><span className="px-3 py-3 text-sm text-[var(--mikke-muted-light)]">/community/c/</span><input required minLength={3} pattern="[a-z0-9][a-z0-9-]{2,59}" value={slug} onChange={(event) => { setSlugTouched(true); setSlug(slugify(event.target.value)); }} className="min-w-0 flex-1 rounded-r-lg px-2 py-3 outline-none" /></div></label>
        {isMikkeReservedSlug(slug) || isMikkeReservedDisplayName(name) ? <p className="mt-2 rounded-lg bg-[var(--mikke-accent-soft)] px-3 py-2 text-xs font-bold text-[var(--mikke-accent-strong)]">mikke / official / admin など公式・運営用の名前は予約されています。一般Communityでは別の名前を使ってください。</p> : null}
        <label className="mt-4 block"><span className="text-sm font-bold">説明</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] px-4 py-3 leading-6" /></label>
        <label className="mt-4 block"><span className="text-sm font-bold">あなたの表示名</span><input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] px-4 py-3" /></label>
        {error ? <p className="mt-4 rounded-lg bg-[var(--mikke-accent-soft)] p-3 text-sm font-bold text-[var(--mikke-accent-strong)]">{error}</p> : null}
        <div className="mt-5 flex flex-wrap gap-2"><button disabled={saving || !user || Boolean(createBlock)} className="rounded-lg bg-[var(--mikke-accent)] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? "作成中..." : "Communityを作成"}</button><Link href="/community/start" className="rounded-lg border border-[var(--mikke-line)] px-5 py-3 text-sm font-bold text-[var(--mikke-primary)]">契約状態へ戻る</Link></div>
      </form>
    </HubFrame>
  );
}
