import {serveLocalCourseCheckout} from '@/lib/academy2/course-checkout-server';
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{action:string}>}){
 const {action}=await context.params;
 if(action!=='read'&&action!=='complete')return new Response(null,{status:404});
 return serveLocalCourseCheckout(action,request);
}
