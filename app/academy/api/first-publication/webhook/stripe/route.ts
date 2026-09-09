import { serveWebhook } from '@/lib/academy/first-publication-billing/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function POST(request: Request) { return serveWebhook(request); }
