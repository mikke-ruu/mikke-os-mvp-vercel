/** Local provider is an explicit development adapter, never a Stripe fallback. */
export function localPaymentReviewRuntime(env) {
  const localRuntime = env.NODE_ENV === 'development'
    || (env.NODE_ENV === 'production' && env.ACADEMY2_LOCAL_BUILT_REVIEW === '1');
  return localRuntime && env.ACADEMY2_LOCAL_PAYMENT_SIMULATOR === '1'
    && env.NEXT_PUBLIC_SUPABASE_URL === 'http://127.0.0.1:57680';
}
export function localOpeningCheckoutEnabled(env, request) {
  if (!localPaymentReviewRuntime(env)) return false;
  try {
    const url = new URL(request.url);
    // Next constructs an internal localhost URL while retaining the actual
    // loopback Host and browser Origin. Both headers remain exact requirements.
    return ['http://127.0.0.1:57670', 'http://localhost:57670'].includes(url.origin)
      && request.headers.get('host') === '127.0.0.1:57670'
      && request.headers.get('origin') === 'http://127.0.0.1:57670'
      && (!request.headers.has('x-forwarded-host') || request.headers.get('x-forwarded-host') === '127.0.0.1:57670');
  } catch { return false; }
}

export const checkoutUuid = value => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function openingCheckoutInput(action, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const keys = action === 'create' ? ['applicationId', 'requestId'] : ['checkoutId'];
  return Object.keys(input).length === keys.length && keys.every(key => checkoutUuid(input[key]));
}
