import type { Session } from "@supabase/supabase-js";

export function createCommunityAuthScope() {
  let epoch = 0;
  let identity: string | null | undefined;
  let session: Session | null = null;
  return {
    observe(next: Session | null) {
      const nextSession = next?.user && !next.user.is_anonymous ? next : null;
      const nextIdentity = nextSession?.user.id ?? null;
      session = nextSession;
      if (identity === nextIdentity) return false;
      identity = nextIdentity;
      epoch++;
      return true;
    },
    capture() {
      const captured = epoch;
      const user = session?.user ?? null;
      return { epoch: captured, user, isCurrent: () => captured === epoch,
        accessToken: () => {
          if (captured !== epoch || !user || session?.user.id !== user.id) throw new Error("ログイン状態が変わりました。画面を開き直してください。");
          return session.access_token;
        } };
    },
    invalidate() { epoch++; identity = undefined; session = null; }
  };
}
export type CommunityAuthLease = ReturnType<ReturnType<typeof createCommunityAuthScope>["capture"]>;
