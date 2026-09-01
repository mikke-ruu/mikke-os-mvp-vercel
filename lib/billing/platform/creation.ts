import { hasExactKeys, isCanonicalTime, isRecord, isResourceId } from './contracts';
import type { PlatformScope, PlatformStatusV0 } from './contracts';

export type CreationEntitlementProjection = {
  state: 'none' | 'available' | 'consumed';
  planKey: string | null;
  resourceId: string | null;
  expiresAt: string | null;
};

const PLAN_KEY = /^[a-z][a-z0-9_]{0,39}$/;

export function decodeCreationEntitlementProjection(
  raw: unknown,
  scope: PlatformScope,
): CreationEntitlementProjection | null {
  if (!isRecord(raw) || !hasExactKeys(raw, ['state', 'planKey', 'resourceId', 'expiresAt'])) return null;
  if (raw.state !== 'none' && raw.state !== 'available' && raw.state !== 'consumed') return null;
  if (raw.planKey !== null && (typeof raw.planKey !== 'string' || !PLAN_KEY.test(raw.planKey))) return null;
  if (raw.resourceId !== null && !isResourceId(raw.resourceId)) return null;
  if (raw.expiresAt !== null && !isCanonicalTime(raw.expiresAt)) return null;
  if (raw.state === 'none' && (raw.planKey !== null || raw.resourceId !== scope.resourceId || raw.expiresAt !== null)) return null;
  if (raw.state === 'available' && (raw.planKey === null || raw.resourceId !== null || scope.resourceId !== null)) return null;
  if (raw.state === 'consumed' && (raw.planKey === null || raw.resourceId !== scope.resourceId || scope.resourceId === null)) return null;
  return {
    state: raw.state,
    planKey: raw.planKey,
    resourceId: raw.resourceId === null ? null : raw.resourceId.toLowerCase(),
    expiresAt: raw.expiresAt,
  };
}

export function projectCreationEntitlementStatus(
  scope: PlatformScope,
  projection: CreationEntitlementProjection,
): PlatformStatusV0 {
  return {
    version: 0,
    ...scope,
    availability: 'ready',
    subscription: null,
    creation: { state: projection.state },
    allowedActions: projection.state === 'available' ? ['create_resource'] : [],
    noticeCode: null,
  };
}
