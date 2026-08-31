import { servePlatformRequest } from '@/lib/billing/platform/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;
export function GET(request: Request) { return servePlatformRequest('status', request); }
