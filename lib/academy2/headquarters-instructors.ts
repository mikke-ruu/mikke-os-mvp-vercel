import type {AssignmentRequest} from './instructor-assignments';
import { supabase } from '@/lib/supabase/client';

/** Requires the separately reviewed HQ instructor read candidate; no legacy fallback. */
export type HeadquartersInstructor = {
 id:string;name:string|null;instructorNumber:string|null;courseId:string;courseName:string|null;
 /** Existing registration value, not the new four-state application review model. */
 registrationStatus:string;certified:boolean;listed:boolean;
 connectReady?:boolean;acceptHqRequests?:boolean;assignmentRequests?:AssignmentRequest[];
 activities:Array<{id:string;salesPlanId:string;status:'active'|'payment_pending'|'leave'|'suspended';licenseEffective:boolean;transitionReviewRequired:boolean}>;
};
export async function listHeadquartersInstructors(headquartersId:string,instructorId:string|null=null):Promise<HeadquartersInstructor[]> {
 const {data,error}=await supabase.rpc('academy2_hq_instructors',{p_headquarters_id:headquartersId,p_instructor_id:instructorId});
 if(error)throw new Error(error.code==='42501'?'この本部の講師情報を確認する権限がありません。':error.code==='PGRST202'||error.code==='42883'?'講師情報の接続を準備しています。':'講師情報を取得できませんでした。もう一度お試しください。');
 if(!Array.isArray(data))throw new Error('講師情報を確認できませんでした。');
 return data as HeadquartersInstructor[];
}
