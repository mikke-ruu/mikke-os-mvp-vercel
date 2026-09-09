"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { createCommunityAuthScope, type CommunityAuthLease } from "@/lib/community/auth-scope";

export function communityScopedClient(lease: CommunityAuthLease) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    accessToken: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !lease.isCurrent() || !data.session || data.session.user.is_anonymous || data.session.user.id !== lease.user?.id) {
        throw new Error("ログイン状態が変わりました。画面を開き直してください。");
      }
      // This request uses the checked actor's token, never a later singleton token.
      return data.session.access_token;
    }
  });
}

export function CommunityAuthBoundary({ children }: { children: (lease: CommunityAuthLease) => ReactNode }) {
  const scope = useRef(createCommunityAuthScope());
  const [lease, setLease] = useState<CommunityAuthLease | null>(null);
  useEffect(() => {
    let mounted = true;
    let observed = false;
    const apply = (session: Parameters<typeof scope.current.observe>[0]) => {
      if (!mounted) return;
      // Invalidate synchronously, before React remounts children or queued replies run.
      if (scope.current.observe(session)) setLease(scope.current.capture());
    };
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { observed = true; apply(session); });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!observed) apply(error ? null : data.session);
    }).catch(() => { if (!observed) apply(null); });
    return () => { mounted = false; scope.current.invalidate(); data.subscription.unsubscribe(); };
  }, []);
  if (!lease) return <p className="p-5 text-sm">ログイン状態を確認しています...</p>;
  return children(lease);
}
