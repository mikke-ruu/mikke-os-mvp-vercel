import {serveLocalMonthlyReview,type MonthlyAction} from '@/lib/academy2/monthly-review-server';
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{action:string}>}){
 const {action}=await context.params;
 if(!['capability','quote','submit','read','complete','materials'].includes(action))return new Response(null,{status:404});
 return serveLocalMonthlyReview(action as MonthlyAction,request);
}

