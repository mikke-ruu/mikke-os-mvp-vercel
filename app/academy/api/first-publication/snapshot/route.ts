import { serveSnapshot } from '@/lib/academy/first-publication-billing/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export function GET(request: Request) {
  return serveSnapshot(request);
}
