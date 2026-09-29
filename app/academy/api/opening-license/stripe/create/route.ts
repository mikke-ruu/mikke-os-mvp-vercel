import { serveOpeningStripe } from '@/lib/academy2/opening-stripe-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function POST(request:Request){return serveOpeningStripe('create',request);}
