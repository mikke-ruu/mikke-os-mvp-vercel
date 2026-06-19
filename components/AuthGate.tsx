"use client";

import type { User } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ensureProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";
import { LoadingScreen } from "./LoadingScreen";

type AuthContextValue = {
  user: User;
  profile: Profile;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthGate.");
  return value;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const nextUser = data.session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) {
        setLoading(false);
        if (pathname !== "/login") router.replace("/login");
        return;
      }
      try {
        await loadProfile(nextUser);
      } finally {
        if (mounted) setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        router.replace("/login");
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [pathname, router]);

  const value = useMemo(() => {
    if (!user || !profile) return null;
    return { user, profile, refreshProfile };
  }, [user, profile]);

  if (loading || !value) return <LoadingScreen />;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
