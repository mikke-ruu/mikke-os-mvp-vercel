import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { isRecord, unavailableStatus } from './contracts';
import { handlePlatformRequest, PlatformApiError } from './http';
import type { PlatformHttpDependencies } from './http';

// No service-role/Stripe key is read by these request-facing handlers.
// Shipping the code must not enable billing: durable ledger/provider/consent
// integration and a release approval are required before enabling this gate.
function publicEnvironment() {
  if (process.env.PLATFORM_BILLING_API_ENABLED !== '1') throw new PlatformApiError('BILLING_NOT_CONFIGURED');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new PlatformApiError('BILLING_NOT_CONFIGURED');
  try {
    if (new URL(url).protocol !== 'https:') throw new Error('invalid configuration');
  } catch { throw new PlatformApiError('BILLING_NOT_CONFIGURED'); }
  return { url, key };
}
function requestDependencies(): PlatformHttpDependencies {
  let userClient: ReturnType<typeof createClient> | undefined;
  let verifiedUserId: string | undefined;
  const trustedOrigins = ['https://app.mikke-os.com'];
  if (process.env.NODE_ENV === 'development') {
    // No arbitrary request Origin reflection. Local dev ports must be opted in.
    const configured = process.env.PLATFORM_BILLING_LOCAL_ORIGIN;
    if (configured) {
      try {
        const url = new URL(configured);
        if (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
          && url.origin === configured) trustedOrigins.push(configured);
      } catch { /* fail closed */ }
    }
  }
  return {
    trustedOrigins,
    async authenticate(token, signal) {
      const { url, key } = publicEnvironment();
      userClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: {
          headers: { Authorization: `Bearer ${token}` },
          fetch: (input, init) => fetch(input, { ...init, signal, cache: 'no-store', redirect: 'error' })
        }
      });
      const { data, error } = await userClient.auth.getUser(token);
      if (error || !data.user || data.user.is_anonymous !== false) return null;
      verifiedUserId = data.user.id;
      return { userId: data.user.id, anonymous: false };
    },
    async ownsResource(principal, scope, signal) {
      if (!userClient || principal.userId !== verifiedUserId || !scope.resourceId) return false;
      const table = scope.product === 'academy_platform' ? 'academy_headquarters' : 'community_communities';
      const { data, error } = await userClient.from(table).select('id,owner_user_id')
        .eq('id', scope.resourceId).eq('owner_user_id', principal.userId).abortSignal(signal).maybeSingle();
      if (error) throw new PlatformApiError('BILLING_NOT_CONFIGURED');
      const row: unknown = data;
      return isRecord(row) && row.id === scope.resourceId && row.owner_user_id === principal.userId;
    },
    async readStatus(_principal, scope) {
      // No platform ledger exists yet. Never infer a subscription or creation
      // grant from app membership, HQ existence, purchase code or browser flags.
      return unavailableStatus(scope);
    },
    async openPortal() {
      throw new PlatformApiError('BILLING_NOT_CONFIGURED');
    }
  };
}
export function servePlatformRequest(action: 'status' | 'checkout' | 'portal', request: Request) {
  return handlePlatformRequest(action, request, requestDependencies());
}
