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
const authSessionTimeoutMs = 5000;

function withAuthTimeout<T>(promise: Promise<T>) {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      window.setTimeout(() => reject(new Error("Auth session check timed out.")), authSessionTimeoutMs);
    })
  ]);
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

function AuthGateInner({ children, allowGuest }: { children: React.ReactNode; allowGuest: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const nextPath = search ? `${pathname}?${search}` : pathname;
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(nextUser: User) {
    const nextProfile = await ensureProfile(nextUser);
    setProfile(nextProfile);
  }

  async function refreshProfile() {
    if (!user) return;
    await loadProfile(user);
  }

  useEffect(() => {
    let mounted = true;

    withAuthTimeout(supabase.auth.getSession()).then(async ({ data }) => {
      if (!mounted) return;
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
      } finally {
        if (mounted) setLoading(false);
      }
    }).catch(() => {
      if (!mounted) return;
      if (allowGuest) {
        setUser(marketNoteGuestUser);
        setProfile(marketNoteGuestProfile);
        setLoading(false);
        return;
      }
      setLoading(false);
      if (pathname !== "/login") router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
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
  }, [allowGuest, nextPath, pathname, router]);

  const value = useMemo(() => {
    if (!user || !profile) return null;
    return { user, profile, isGuest: profile.id === marketNoteGuestProfile.id, refreshProfile };
  }, [user, profile]);

  if (loading || !value) return <LoadingScreen />;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
