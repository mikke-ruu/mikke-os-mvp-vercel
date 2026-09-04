// Public, provider-independent v0 contract. Importing this file never reads env.
export type PlatformProduct = 'community_platform' | 'academy_platform';
export type PlatformAction = 'checkout' | 'portal' | 'create_resource' | 'start_trial';
export type PlatformErrorCode = 'AUTH_REQUIRED' | 'RESOURCE_UNAVAILABLE' | 'STATE_CONFLICT'
  | 'INVALID_REQUEST' | 'BILLING_NOT_CONFIGURED' | 'POLICY_PENDING';
export type PlatformScope = { product: PlatformProduct; resourceId: string | null };
export type PlatformStatusV0 = PlatformScope & {
  version: 0;
  availability: 'ready' | 'not_configured' | 'policy_pending';
  subscription: null | {
    state: 'pending' | 'trialing' | 'active' | 'past_due' | 'ended';
    planKey: string;
    currentPeriodStartsAt: string | null;
    currentPeriodEndsAt: string | null;
    automaticBilling: boolean;
    cancelAtPeriodEnd: boolean;
  };
  creation: { state: 'none' | 'pending' | 'available' | 'consumed' };
  allowedActions: PlatformAction[];
  noticeCode: PlatformErrorCode | null;
};
export type CheckoutRequestV0 = PlatformScope & { planKey: string; requestId: string };
export type PortalRequestV0 = { product: PlatformProduct; resourceId: string; requestId: string };
export type CommunityTrialStartRequest = {
  product: 'community_platform';
  resourceId: null;
  requestId: string;
};
export type CommunityTrialStartResult = {
  state: 'trialing';
  startsAt: string;
  endsAt: string;
  automaticBilling: false;
  creation: { state: 'available' };
};

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const platformErrorCodes: readonly PlatformErrorCode[] = [
  'AUTH_REQUIRED', 'RESOURCE_UNAVAILABLE', 'STATE_CONFLICT', 'INVALID_REQUEST',
  'BILLING_NOT_CONFIGURED', 'POLICY_PENDING'
];
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
export function isProduct(value: unknown): value is PlatformProduct {
  return value === 'community_platform' || value === 'academy_platform';
}
export function isResourceId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
export function isCanonicalTime(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}
export function parseScope(value: unknown): PlatformScope | null {
  if (!isRecord(value) || !hasExactKeys(value, ['product', 'resourceId']) || !isProduct(value.product)) return null;
  if (value.resourceId !== null && !isResourceId(value.resourceId)) return null;
  return { product: value.product, resourceId: value.resourceId === null ? null : value.resourceId.toLowerCase() };
}
export function parseCheckout(value: unknown): CheckoutRequestV0 | null {
  if (!isRecord(value) || !hasExactKeys(value, ['product', 'resourceId', 'planKey', 'requestId'])) return null;
  const scope = parseScope({ product: value.product, resourceId: value.resourceId });
  if (!scope || !isResourceId(value.requestId) || typeof value.planKey !== 'string'
    || !/^[a-z][a-z0-9_]{0,39}$/.test(value.planKey)) return null;
  return { ...scope, requestId: value.requestId.toLowerCase(), planKey: value.planKey };
}
export function parsePortal(value: unknown): PortalRequestV0 | null {
  if (!isRecord(value) || !hasExactKeys(value, ['product', 'resourceId', 'requestId'])
    || !isProduct(value.product) || !isResourceId(value.resourceId) || !isResourceId(value.requestId)) return null;
  return { product: value.product, resourceId: value.resourceId.toLowerCase(), requestId: value.requestId.toLowerCase() };
}

export function parseCommunityTrialStart(value: unknown): CommunityTrialStartRequest | null {
  if (!isRecord(value) || !hasExactKeys(value, ['product', 'resourceId', 'requestId'])
    || value.product !== 'community_platform' || value.resourceId !== null || !isResourceId(value.requestId)) return null;
  return { product: 'community_platform', resourceId: null, requestId: value.requestId.toLowerCase() };
}

export function decodeCommunityTrialStartResult(value: unknown): CommunityTrialStartResult | null {
  if (!isRecord(value) || !hasExactKeys(value, ['state', 'startsAt', 'endsAt', 'automaticBilling', 'creation'])
    || value.state !== 'trialing' || !isCanonicalTime(value.startsAt) || !isCanonicalTime(value.endsAt)
    || value.endsAt <= value.startsAt || value.automaticBilling !== false
    || !isRecord(value.creation) || !hasExactKeys(value.creation, ['state']) || value.creation.state !== 'available') return null;
  return value as CommunityTrialStartResult;
}
export function unavailableStatus(scope: PlatformScope): PlatformStatusV0 {
  return { version: 0, ...scope, availability: 'not_configured', subscription: null,
    creation: { state: 'none' }, allowedActions: [], noticeCode: 'BILLING_NOT_CONFIGURED' };
}
export function decodePlatformStatus(value: unknown, scope: PlatformScope): PlatformStatusV0 | null {
  if (!isRecord(value) || !hasExactKeys(value, ['version', 'product', 'resourceId', 'availability', 'subscription', 'creation', 'allowedActions', 'noticeCode'])
    || value.version !== 0 || value.product !== scope.product || value.resourceId !== scope.resourceId
    || typeof value.availability !== 'string' || !['ready', 'not_configured', 'policy_pending'].includes(value.availability)) return null;
  if (!isRecord(value.creation) || !hasExactKeys(value.creation, ['state'])
    || typeof value.creation.state !== 'string' || !['none', 'pending', 'available', 'consumed'].includes(value.creation.state)) return null;
  if (!Array.isArray(value.allowedActions) || value.allowedActions.some(v => !['checkout', 'portal', 'create_resource', 'start_trial'].includes(v))
    || new Set(value.allowedActions).size !== value.allowedActions.length) return null;
  if (value.noticeCode !== null && !platformErrorCodes.includes(value.noticeCode as PlatformErrorCode)) return null;
  if (value.availability !== 'ready' && value.allowedActions.length !== 0) return null;
  if (value.noticeCode !== null && value.allowedActions.length !== 0) return null;
  if (value.subscription !== null) {
    const sub = value.subscription;
    if (!isRecord(sub) || !hasExactKeys(sub, ['state', 'planKey', 'currentPeriodStartsAt', 'currentPeriodEndsAt', 'automaticBilling', 'cancelAtPeriodEnd'])
      || typeof sub.state !== 'string' || !['pending', 'trialing', 'active', 'past_due', 'ended'].includes(sub.state)
      || typeof sub.planKey !== 'string' || !/^[a-z][a-z0-9_]{0,39}$/.test(sub.planKey)
      || typeof sub.automaticBilling !== 'boolean'
      || typeof sub.cancelAtPeriodEnd !== 'boolean'
      || (sub.currentPeriodStartsAt !== null && !isCanonicalTime(sub.currentPeriodStartsAt))
      || (sub.currentPeriodEndsAt !== null && !isCanonicalTime(sub.currentPeriodEndsAt))) return null;
  }
  return value as PlatformStatusV0;
}

// A URL is never proof of payment. Restrict provider navigation separately.
export function isPlatformRedirect(value: unknown, action: 'checkout' | 'portal'): value is string {
  if (typeof value !== 'string' || value.length > 4096) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && url.hostname === (action === 'checkout' ? 'checkout.stripe.com' : 'billing.stripe.com');
  } catch { return false; }
}
