import {supabase} from '@/lib/supabase/client';
import {getOwnedHeadquarters,updateHeadquarters} from '@/lib/academy/headquarters';
import {getMyAcademyHeadquartersAccess} from '@/lib/academy/trial';
import {assertAcademyWritable} from '@/lib/academy/preview';
import {musubiLegacyCandidate} from './musubi-legacy-candidate-config';
import {createLegacyPaidTargetAdapter,matchesLegacyPaidTarget} from './legacy-paid-target.mjs';
export function getMusubiLegacyPaidAdapter(userId:string,headquartersId:string|null|undefined){
 if(!matchesLegacyPaidTarget(musubiLegacyCandidate,userId,headquartersId))return null;
 return createLegacyPaidTargetAdapter(musubiLegacyCandidate,{
  getUser:async()=>{const {data,error}=await supabase.auth.getUser();if(error)throw error;return data.user;},
  getHeadquarters:(id,actor)=>getOwnedHeadquarters(actor,id),getAccess:getMyAcademyHeadquartersAccess,
  updateProfile:async(id,patch)=>{assertAcademyWritable();return updateHeadquarters(id,patch as Parameters<typeof updateHeadquarters>[1]);},now:Date.now
 });
}
