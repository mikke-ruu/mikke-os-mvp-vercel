import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {localPaymentReviewRuntime} from '@/lib/academy2/opening-checkout-policy.mjs';
import {LocalCourseCheckout} from '@/components/academy2/LocalCourseCheckout';
export default async function Page(){
 const values=await headers();
 if(!localPaymentReviewRuntime(process.env)||values.get('host')!=='127.0.0.1:57670'
  ||(values.has('x-forwarded-host')&&values.get('x-forwarded-host')!=='127.0.0.1:57670'))notFound();
 return <LocalCourseCheckout/>;
}
