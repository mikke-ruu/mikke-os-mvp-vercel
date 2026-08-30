"use client";

import type { User } from "@supabase/supabase-js";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, Suspense, useContext, useEffect, useMemo, useState } from "react";
import { ensureProfile } from "@/lib/profile";
import { MARKETNOTE_GUEST_USER_ID, marketNoteGuestProfile } from "@/lib/marketnote-guest";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";
import { LoadingScreen } from "./LoadingScreen";

type AuthContextValue = {
  user: User;
  profile: Profile;
  isGuest: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const authSessionTimeoutMs = 15000;

function withAuthTimeout<T>(promise: Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Auth session check timed out.")), authSessionTimeoutMs);
    promise.then(
      (value) => { window.clearTimeout(timeout); resolve(value); },
      (error) => { window.clearTimeout(timeout); reject(error); }
    );
  });
}

async function getSessionWithRetry() {
  try {
    return await withAuthTimeout(supabase.auth.getSession());
  } catch {
    return withAuthTimeout(supabase.auth.getSession());
  }
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthGate.");
  return value;
}

// useSearchParams() requires a Suspense boundary during build-time
// prerendering, or every page that renders AuthGate fails the production
// build. AuthGate itself provides that boundary so no caller has to.
export function AuthGate({ children, allowGuest = false }: { children: React.ReactNode; allowGuest?: boolean }) {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AuthGateInner allowGuest={allowGuest}>{children}</AuthGateInner>
    </Suspense>
  );
}

const marketNoteGuestUser = {
  id: MARKETNOTE_GUEST_USER_ID,
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: marketNoteGuestProfile.created_at
} as User;

const academyLocalReviewUser = {
  id: "00000000-0000-4000-8000-000000009001",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-08-22T00:00:00.000Z"
} as User;

const academyLocalReviewProfile: Profile = {
  id: "00000000-0000-4000-8000-000000009002",
  user_id: academyLocalReviewUser.id,
  display_name: "Academy確認用",
  handle: "academy_preview",
  bio: null,
  area: null,
  avatar_url: null,
  website_url: null,
  instagram_url: null,
  member_number: null,
  joined_at: "2026-08-22T00:00:00.000Z",
  created_at: "2026-08-22T00:00:00.000Z",
  updated_at: "2026-08-22T00:00:00.000Z"
};

function AuthGateInner({ children, allowGuest }: { children: React.ReactNode; allowGuest: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const nextPath = search ? `${pathname}?${search}` : pathname;
  const previewMode = searchParams.get("preview") ?? "";
  const localAcademyReview =
    process.env.NODE_ENV === "development" &&
    pathname.startsWith("/academy") &&
    ["dashboard", "walkthrough", "trial"].includes(previewMode);
  const localCommunityAcademyInvitationReview =
    process.env.NODE_ENV === "development" &&
    pathname === "/community/academy-invitations/preview" &&
    previewMode === "walkthrough";
  const localFixtureUser = localAcademyReview
    ? academyLocalReviewUser
    : localCommunityAcademyInvitationReview
      ? marketNoteGuestUser
      : null;
  const localFixtureProfile = localAcademyReview
    ? academyLocalReviewProfile
    : localCommunityAcademyInvitationReview
      ? marketNoteGuestProfile
      : null;
  const localFixtureReview = Boolean(localFixtureUser && localFixtureProfile);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authUnavailable, setAuthUnavailable] = useState(false);

  async function loadProfile(nextUser: User) {
    const nextProfile = await ensureProfile(nextUser);
    setProfile(nextProfile);
  }

  async function refreshProfile() {
    if (localFixtureReview) return;
    if (!user) return;
    await loadProfile(user);
  }

  useEffect(() => {
    let mounted = true;

    if (localFixtureReview) {
      return () => {
        mounted = false;
      };
    }

    getSessionWithRetry().then(async ({ data, error }) => {
      if (!mounted) return;
      if (error) throw error;
      const nextUser = data.session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) {
        if (allowGuest) {
          setUser(marketNoteGuestUser);
          setProfile(marketNoteGuestProfile);
          setLoading(false);
          return;
        }
        setLoading(false);
        if (pathname !== "/login") router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
        return;
      }
      try {
        await loadProfile(nextUser);
      } catch {
        if (mounted) setAuthUnavailable(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }).catch(() => {
      if (!mounted) return;
      setLoading(false);
      setAuthUnavailable(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setAuthUnavailable(false);
      if (nextUser) {
        window.setTimeout(() => {
          if (!mounted) return;
          void loadProfile(nextUser).then(() => {
            if (mounted) setLoading(false);
          }).catch(() => {
            if (mounted) { setLoading(false); setAuthUnavailable(true); }
          });
        }, 0);
        return;
      }
      if (!nextUser) {
        if (allowGuest) {
          setUser(marketNoteGuestUser);
          setProfile(marketNoteGuestProfile);
          return;
        }
        setProfile(null);
        router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [allowGuest, localFixtureReview, nextPath, pathname, router]);

  const value = useMemo(() => {
    const nextUser = localFixtureUser ?? user;
    const nextProfile = localFixtureProfile ?? profile;
    if (!nextUser || !nextProfile) return null;
    return { user: nextUser, profile: nextProfile, isGuest: nextProfile.id === marketNoteGuestProfile.id, refreshProfile };
  }, [localFixtureProfile, localFixtureUser, user, profile]);

  if (!localFixtureReview && authUnavailable) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--mikke-surface-soft)] px-5 text-center">
        <div className="max-w-sm rounded-2xl border border-[var(--mikke-line)] bg-white p-6">
          <h1 className="text-lg font-bold text-[var(--mikke-primary)]">ログイン状態を確認できませんでした</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--mikke-muted)]">通信状態を確認して、画面を読み込み直してください。ログアウトはされていません。</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 w-full rounded-xl bg-[var(--mikke-primary)] px-4 py-3 text-sm font-bold text-white">もう一度読み込む</button>
        </div>
      </main>
    );
  }

  if ((!localFixtureReview && loading) || !value) return <LoadingScreen />;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
