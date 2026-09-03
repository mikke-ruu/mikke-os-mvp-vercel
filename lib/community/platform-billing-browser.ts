import type { CommunityBillingTransport } from "./platform-billing";

export const communityPlatformBrowserTransport: CommunityBillingTransport = {
  async getAccessToken() {
    const { supabase } = await import("@/lib/supabase/client");
    const { data, error } = await supabase.auth.getSession();
    return error ? null : data.session?.access_token ?? null;
  },
  fetch: (input, init) => fetch(input, init)
};
