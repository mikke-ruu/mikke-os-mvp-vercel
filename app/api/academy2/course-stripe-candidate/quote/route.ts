import {serveCourseStripeQuote} from '@/lib/academy2/course-stripe-server-candidate';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){return serveCourseStripeQuote(request);}
