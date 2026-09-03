import { servePlatformRequest } from '@/lib/billing/platform/server';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const revalidate=0;
export function POST(request:Request){return servePlatformRequest('quote',request);}
