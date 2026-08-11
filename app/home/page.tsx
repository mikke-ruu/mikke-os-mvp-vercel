"use client";

import { BookOpenText, CalendarDays, ExternalLink, LogIn } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MikkeAppsTileGrid } from "@/components/mikkeos/MikkeOwnerMenu";
import { useOwnedMikkeApps } from "@/components/mikkeos/useOwnedMikkeApps";
import { marketNoteApp, storyApp } from "@/lib/mikkeos/released-apps";
import { supabase } from "@/lib/supabase/client";

export default function HomePage() {
  const [userId, setUserId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const { ownedApps, suggestedApps } = useOwnedMikkeApps({ userId });

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUserId(data.user?.id);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUserId(session?.user.id);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="min-h-screen bg-[var(--mikke-surface-soft)] px-4 py-8 text-[var(--mikke-text)] sm:px-5 sm:py-12">
      <div className="mx-auto w-full max-w-xl">
        <header className="rounded-2xl border border-[var(--mikke-line)] bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--mikke-accent)]">MIKKEOS</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--mikke-primary)]">使うアプリを選んでください</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--mikke-muted)]">
            ホーム画面のmikkeOSアイコンから開いたときは、ここから使いたいアプリへ進めます。
          </p>
        </header>

        {loading ? (
          <section className="mt-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-6 text-sm font-semibold text-[var(--mikke-muted)]">確認しています...</section>
        ) : userId ? (
          <>
            <section className="mt-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold text-[var(--mikke-primary)]">持ってるアプリ</h2>
              {ownedApps.length > 0 ? (
                <div className="mt-3">
                  <MikkeAppsTileGrid apps={ownedApps} />
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-[var(--mikke-muted)]">まだ使い始めたアプリはありません。下から選べます。</p>
              )}
            </section>

            {suggestedApps.length > 0 ? (
              <section className="mt-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold text-[var(--mikke-primary)]">つなげられるアプリ</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {suggestedApps.map((app) => (
                    <Link key={app.name} href={app.href ?? "/home"} className="rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4">
                      <span className="block text-sm font-bold text-[var(--mikke-text)]">{app.name}</span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--mikke-muted)]">{app.helper}</span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <section className="mt-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[var(--mikke-primary)]">続きから使う</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">ログインすると、使っているアプリと保存した内容を確認できます。</p>
            <Link href="/login?next=/home" className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--mikke-primary)] px-4 text-sm font-bold text-white">
              <LogIn size={18} />
              ログイン・新規登録
            </Link>

            <div className="my-5 flex items-center gap-3 text-xs font-semibold text-[var(--mikke-muted-light)]" aria-hidden="true">
              <span className="h-px flex-1 bg-[var(--mikke-line)]" />
              または
              <span className="h-px flex-1 bg-[var(--mikke-line)]" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link href={marketNoteApp.href} className="rounded-xl bg-[var(--mikke-orange)] p-4 text-white">
                <CalendarDays size={22} />
                <span className="mt-2 block text-sm font-bold">MarketNote</span>
                <span className="mt-1 block text-xs leading-5">ログインせずに使えます</span>
              </Link>
              <Link href={storyApp.href} className="rounded-xl bg-[var(--mikke-blue)] p-4 text-white">
                <BookOpenText size={22} />
                <span className="mt-2 block text-sm font-bold">Story</span>
                <span className="mt-1 block text-xs leading-5">自分のStoryを開きます</span>
              </Link>
            </div>
          </section>
        )}

        <a href="https://mikke-os.com/" className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--mikke-line)] bg-white px-4 text-sm font-bold text-[var(--mikke-primary)]">
          mikkeOSホームページを見る
          <ExternalLink size={16} />
        </a>
      </div>
    </main>
  );
}
