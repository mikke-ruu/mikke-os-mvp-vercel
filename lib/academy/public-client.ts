import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Supabase environment variables are missing.");

// Public DTO reads must not wait for an unrelated saved login to refresh.
// Applications, purchase history and all writes continue using the authenticated client.
export const academyPublicClient = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: "academy-public-read",
  },
});
