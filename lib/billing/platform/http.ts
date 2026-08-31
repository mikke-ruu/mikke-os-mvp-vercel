import {
  decodePlatformStatus, isPlatformRedirect, isResourceId, parseCheckout, parsePortal, parseScope
} from './contracts';
import type { PlatformErrorCode, PlatformScope, PortalRequestV0 } from './contracts';

export class PlatformApiError extends Error {
  readonly code: PlatformErrorCode;
  constructor(code: PlatformErrorCode) { super(code); this.code = code; }
}
export type PlatformPrincipal = { userId: string; anonymous: boolean };
export type PlatformHttpDependencies = {
  // Creates request-local dependencies; do not retain tokens or principals globally.
  authenticate(token: string, signal: AbortSignal): Promise<PlatformPrincipal | null>;
  ownsResource(principal: PlatformPrincipal, scope: PlatformScope, signal: AbortSignal): Promise<boolean>;
  readStatus(principal: PlatformPrincipal, scope: PlatformScope, signal: AbortSignal): Promise<unknown>;
  // Implementation must bind its persistent idempotency key to owner/product/resource/request.
  openPortal(principal: PlatformPrincipal, input: PortalRequestV0, signal: AbortSignal): Promise<string>;
  trustedOrigins: readonly string[];
};
const statusByCode: Record<PlatformErrorCode, number> = {
  AUTH_REQUIRED: 401, RESOURCE_UNAVAILABLE: 404, STATE_CONFLICT: 409,
  INVALID_REQUEST: 422, BILLING_NOT_CONFIGURED: 503, POLICY_PENDING: 503
};
function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: {
    'Cache-Control': 'private, no-store, max-age=0', 'Vary': 'Authorization, Origin',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'
  } });
}
function fail(code: PlatformErrorCode): never { throw new PlatformApiError(code); }
function bearer(request: Request): string {
  const value = request.headers.get('authorization');
  if (!value || value.length > 8192 || !/^Bearer [A-Za-z0-9._~-]+$/.test(value)) fail('AUTH_REQUIRED');
  return value.slice(7);
}
function enforceOrigin(request: Request, allowed: readonly string[], mutation: boolean) {
  const origin = request.headers.get('origin');
  if (!origin && mutation) fail('INVALID_REQUEST');
  if (origin && !allowed.includes(origin)) fail('INVALID_REQUEST');
  if (request.headers.get('sec-fetch-site') === 'cross-site') fail('INVALID_REQUEST');
}
async function boundedJson(request: Request, signal: AbortSignal): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') fail('INVALID_REQUEST');
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 4096)) fail('INVALID_REQUEST');
  const reader = request.body?.getReader();
  if (!reader) fail('INVALID_REQUEST');
  const chunks: Uint8Array[] = [];
  let size = 0;
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    signal.throwIfAborted();
    while (true) {
      const result = await reader.read();
      signal.throwIfAborted();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > 4096) { await reader.cancel(); fail('INVALID_REQUEST'); }
      chunks.push(result.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch { fail('INVALID_REQUEST'); }
  finally { signal.removeEventListener('abort', abort); reader.releaseLock(); }
}
function getScope(request: Request): PlatformScope {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some(key => !['product', 'resourceId'].includes(key))
    || params.getAll('product').length !== 1 || params.getAll('resourceId').length > 1) fail('INVALID_REQUEST');
  const scope = parseScope({ product: params.get('product'), resourceId: params.get('resourceId') });
  if (!scope) fail('INVALID_REQUEST');
  return scope;
}

export async function handlePlatformRequest(
  action: 'status' | 'checkout' | 'portal', request: Request, dependencies: PlatformHttpDependencies
): Promise<Response> {
  try {
    if (request.method !== (action === 'status' ? 'GET' : 'POST')) fail('INVALID_REQUEST');
    const token = bearer(request); // Never accept cookies, URLs, caller user IDs or decoded metadata as auth.
    enforceOrigin(request, dependencies.trustedOrigins, action !== 'status');
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10000)]);
    const principal = await dependencies.authenticate(token, signal);
    if (!principal || principal.anonymous !== false || !isResourceId(principal.userId)) fail('AUTH_REQUIRED');
    const input = action === 'status' ? getScope(request)
      : action === 'checkout' ? parseCheckout(await boundedJson(request, signal)) : parsePortal(await boundedJson(request, signal));
    if (!input) fail('INVALID_REQUEST');
    const scope: PlatformScope = { product: input.product, resourceId: input.resourceId };
    if (scope.resourceId !== null && !(await dependencies.ownsResource(principal, scope, signal))) fail('RESOURCE_UNAVAILABLE');
    const status = decodePlatformStatus(await dependencies.readStatus(principal, scope, signal), scope);
    if (!status) fail('BILLING_NOT_CONFIGURED');
    if (action === 'status') return json(status);
    if (status.availability === 'not_configured') fail('BILLING_NOT_CONFIGURED');
    if (status.availability === 'policy_pending') fail('POLICY_PENDING');
    // v0 has no accepted immutable quote/legal revision. No caller can bypass final consent.
    if (action === 'checkout') fail('POLICY_PENDING');
    if (status.noticeCode !== null || !status.allowedActions.includes('portal') || !status.subscription) fail('STATE_CONFLICT');
    const portal = parsePortal(input);
    if (!portal) fail('INVALID_REQUEST');
    const url = await dependencies.openPortal(principal, portal, signal);
    if (!isPlatformRedirect(url, 'portal')) fail('BILLING_NOT_CONFIGURED');
    return json({ version: 0, redirectUrl: url });
  } catch (error) {
    const code = error instanceof PlatformApiError ? error.code : 'BILLING_NOT_CONFIGURED';
    return json({ error: { code } }, statusByCode[code]);
  }
}
