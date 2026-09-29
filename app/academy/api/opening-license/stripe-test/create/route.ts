import { serveOpeningStripeTest } from '@/lib/academy2/opening-stripe-test-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function POST(request:Request){return serveOpeningStripeTest('create',request);}
