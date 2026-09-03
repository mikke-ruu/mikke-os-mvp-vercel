import { isRecord, isResourceId } from './contracts';

export type AcademyResolvedPlan = Readonly<{
  ok: true;
  planKey: 'small' | 'medium' | 'large';
  totalYen: 5000 | 10000 | 20000;
}>;
export type AcademyPlanFailure = Readonly<{ ok: false; reason: 'conflict' | 'unavailable' | 'variable' }>;

export function resolveAcademyBillingPlan(
  resourceId: string | null,
  requestedPlanKey: string,
  rawEstimate: unknown,
  now = new Date(),
): AcademyResolvedPlan | AcademyPlanFailure {
  if (resourceId === null) {
    return requestedPlanKey === 'small'
      ? { ok: true, planKey: 'small', totalYen: 5000 }
      : { ok: false, reason: 'conflict' };
  }
  if (!isResourceId(resourceId) || !Number.isFinite(now.getTime())) return { ok: false, reason: 'unavailable' };
  const row = Array.isArray(rawEstimate) && rawEstimate.length === 1 ? rawEstimate[0] : rawEstimate;
  if (!isRecord(row)
    || typeof row.registered_instructor_count !== 'number' || !Number.isSafeInteger(row.registered_instructor_count) || row.registered_instructor_count < 0
    || typeof row.catalog_price_yen !== 'number' || !Number.isSafeInteger(row.catalog_price_yen) || row.catalog_price_yen < 0
    || typeof row.observed_at !== 'string') return { ok: false, reason: 'unavailable' };
  const observedAt = new Date(row.observed_at);
  if (!Number.isFinite(observedAt.getTime()) || Math.abs(now.getTime() - observedAt.getTime()) > 5 * 60_000)
    return { ok: false, reason: 'unavailable' };
  const count = Number(row.registered_instructor_count), catalogPrice = Number(row.catalog_price_yen);
  if (count > 200) return { ok: false, reason: 'variable' };
  const resolved: AcademyResolvedPlan = count <= 20
    ? { ok: true, planKey: 'small', totalYen: 5000 }
    : count <= 50
      ? { ok: true, planKey: 'medium', totalYen: 10000 }
      : { ok: true, planKey: 'large', totalYen: 20000 };
  if (catalogPrice !== resolved.totalYen) return { ok: false, reason: 'unavailable' };
  return requestedPlanKey === resolved.planKey ? resolved : { ok: false, reason: 'conflict' };
}
