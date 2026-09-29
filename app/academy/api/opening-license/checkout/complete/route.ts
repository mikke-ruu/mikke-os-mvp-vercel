import { serveOpeningCheckout } from '@/lib/academy2/opening-checkout-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function POST(request:Request){return serveOpeningCheckout('complete',request);}
