export function localOpeningCheckoutEnabled(env: Record<string, string | undefined>, request: Request): boolean;
export function localPaymentReviewRuntime(env: Record<string, string | undefined>): boolean;
export function checkoutUuid(value: unknown): value is string;
export function openingCheckoutInput(action: 'create' | 'read' | 'complete', input: unknown): boolean;
