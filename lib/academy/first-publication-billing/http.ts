import type { SetupAttempt } from './stripe-runtime';
export type SetupHttpDependencies = {
  allowedOrigins: readonly string[];
  authenticate(token: string, signal: AbortSignal): Promise<{ id:string; anonymous:boolean } | null>;
  owns(token: string, userId: string, headquartersId: string, signal: AbortSignal): Promise<boolean>;
  reserve(userId: string, headquartersId: string, quoteId: string, signal: AbortSignal): Promise<SetupAttempt>;
  setup(attempt: SetupAttempt, signal: AbortSignal): Promise<{ attemptId:string; setupUrl:string }>;
  confirm(attempt: SetupAttempt, signal: AbortSignal): Promise<{ paymentPreparationId:string; verified:true; quote:unknown }>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function privateJson(value: unknown, status = 200) {
  return Response.json(value,{ status, headers:{ 'Cache-Control':'private, no-store, max-age=0','Vary':'Authorization, Origin','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer' } });
}
export async function readBoundedJson(request: Request, signal: AbortSignal) {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new Error('INVALID_REQUEST');
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > 4096)) throw new Error('INVALID_REQUEST');
  const reader = request.body?.getReader(); if (!reader) throw new Error('INVALID_REQUEST');
  const chunks: Uint8Array[] = []; let count = 0;
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort',abort,{ once:true });
  try {
    for (;;) {
      signal.throwIfAborted(); const part = await reader.read(); signal.throwIfAborted();
      if (part.done) break; count += part.value.byteLength;
      if (count > 4096) { await reader.cancel(); throw new Error('INVALID_REQUEST'); } chunks.push(part.value);
    }
    const bytes = new Uint8Array(count); let offset=0; for (const part of chunks) { bytes.set(part,offset); offset+=part.byteLength; }
    return JSON.parse(new TextDecoder('utf-8',{ fatal:true }).decode(bytes)) as unknown;
  } finally { signal.removeEventListener('abort',abort); reader.releaseLock(); }
}
export async function handleSetupRequest(action: 'setup'|'confirm', request: Request, deps: SetupHttpDependencies): Promise<Response> {
  try {
    const origin = request.headers.get('origin'), requestOrigin = new URL(request.url).origin;
    if (request.method !== 'POST' || !origin || origin !== requestOrigin || !deps.allowedOrigins.includes(origin) || request.headers.get('sec-fetch-site') === 'cross-site') return privateJson({ error:'INVALID_REQUEST' },422);
    const auth = request.headers.get('authorization');
    if (!auth || auth.length > 8192 || !/^Bearer [A-Za-z0-9._~-]+$/.test(auth)) return privateJson({ error:'AUTH_REQUIRED' },401);
    const signal = AbortSignal.any([request.signal,AbortSignal.timeout(20000)]), token=auth.slice(7);
    const user = await deps.authenticate(token,signal);
    if (!user || user.anonymous !== false || !uuid.test(user.id)) return privateJson({ error:'AUTH_REQUIRED' },401);
    let raw: unknown; try { raw=await readBoundedJson(request,signal); } catch { return privateJson({ error:'INVALID_REQUEST' },422); }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return privateJson({ error:'INVALID_REQUEST' },422);
    const body=raw as Record<string,unknown>, expected=action==='setup'?['headquartersId','quoteId']:['headquartersId','quoteId','attemptId'];
    if (Object.keys(body).length!==expected.length || !expected.every(k=>typeof body[k]==='string' && uuid.test(body[k] as string))) return privateJson({ error:'INVALID_REQUEST' },422);
    const hq=body.headquartersId as string, quote=body.quoteId as string;
    if (!await deps.owns(token,user.id,hq,signal)) return privateJson({ error:'RESOURCE_UNAVAILABLE' },404);
    const attempt=await deps.reserve(user.id,hq,quote,signal);
    if (attempt.owner_user_id!==user.id || attempt.headquarters_id!==hq || attempt.quote_id!==quote || !uuid.test(attempt.attempt_id) || (action==='confirm' && body.attemptId!==attempt.attempt_id)) return privateJson({ error:'STATE_CONFLICT' },409);
    return privateJson(action==='setup' ? await deps.setup(attempt,signal) : await deps.confirm(attempt,signal));
  } catch (error) {
    const code=error instanceof Error ? error.message : '';
    const stateErrors=['SETUP_NOT_OPEN','PAYMENT_METHOD_NOT_READY','PROVIDER_UNKNOWN_RECONCILIATION_REQUIRED'];
    return privateJson({ error:stateErrors.includes(code)?code:'BILLING_UNAVAILABLE' },stateErrors.includes(code)?409:503);
  }
}
