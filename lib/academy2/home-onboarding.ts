import {listSalesPlanDrafts} from './sales-plan-drafts';
import {academyPublicClient} from '@/lib/academy/public-client';
import {getPublicHomepage} from '@/lib/academy/public-homepage';
import {safeExternalPaymentUrl} from './public-intake-payments';
import type {HeadquartersSettings} from './headquarters-settings';
import type {HeadquartersHomeData} from './headquarters-home';
import type {PublicOfferingSummary} from '@/lib/academy/public-offerings';

/** Match the existing basic-save contract: name is required; email is optional. */
export function homeBasicComplete(settings:HeadquartersSettings|null,basicSaved:boolean|null,home:HeadquartersHomeData){
 if(!settings)return null;
 if(!settings.basic.name.trim()||settings.basic.name.length>100)return false;
 const email=settings.basic.contact_email.trim();
 if(email&&(email.length>320||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)))return false;
 // Existing saved profiles predate settings.basic.saved. Never backfill their data.
 const legacySaved=!!email||!!settings.basic.tagline.trim()||!!home.logoUrl||!!home.heroImageUrl;
 return basicSaved===true||legacySaved?true:basicSaved===false?false:null;
}

export async function readHomePlanProgress(hq:string){
 const plans=await listSalesPlanDrafts(hq);
 return plans.some(plan=>plan.headquarters_id===hq&&plan.configuration.course_ids.length>0);
}

/** A public listing alone is not an accepting recruitment. Use the public form's read. */
export function homeIntakeAccepting(value:unknown,offering:PublicOfferingSummary,home:HeadquartersHomeData){
 if(!value||typeof value!=='object')return false;
 const intake=value as {mode?:string;offering?:{id?:string;headquarters_id?:string;status?:string;purchase_mode?:string;payment_methods?:string[];external_payment_url?:string};terms?:{body?:string;version?:string};eventRequired?:boolean;events?:{id:string;formReady?:boolean}[];applicationForm?:{readinessReasons?:string[]}};
 if(intake.mode!=='headquarters'||intake.offering?.id!==offering.id||intake.offering.headquarters_id!==home.headquartersId||intake.offering.status!=='published'||intake.offering.purchase_mode!=='all'||!intake.terms?.body?.trim()||!intake.terms.version?.trim()||intake.applicationForm?.readinessReasons?.length)return false;
 const methods=intake.offering.payment_methods??[];
 if(!methods.includes('bank')&&!(methods.includes('external')&&safeExternalPaymentUrl(intake.offering.external_payment_url)))return false;
 if(intake.eventRequired===false)return true;
 if(intake.eventRequired!==true||!Array.isArray(intake.events)||!home.events)return false;
 return intake.events.some(publicEvent=>publicEvent.formReady!==false&&home.events!.some(event=>event.id===publicEvent.id&&event.headquarters_id===home.headquartersId&&event.registration_status==='open'&&['planned','active'].includes(event.status)&&(event.capacity===null||event.application_count<event.capacity)&&(event.schedule_mode==='arranged_after_application'||!!event.starts_at&&new Date(event.ends_at??event.starts_at).getTime()>new Date(home.observedAt).getTime())));
}

export async function readHomeRecruitment(offerings:PublicOfferingSummary[],home:HeadquartersHomeData){
 // Null means unavailable/failed verification, not an incomplete or complete setup.
 let uncertain=false;
 for(const offering of offerings){
  const {data,error}=await academyPublicClient.rpc('academy2_public_intake_with_form',{p_id:offering.id,p_instructor:false}).abortSignal(AbortSignal.timeout(30_000));
  if(error){uncertain=true;continue;}
  if(homeIntakeAccepting(data,offering,home))return true;
 }
 return uncertain?null:false;
}

export async function readHomeHomepage(hq:string,path:string){
 const match=/^\/academy\/site\/([^/?#]+)$/.exec(path);
 if(!match)return false;
 const page=await getPublicHomepage(decodeURIComponent(match[1]));
 return page?.headquarters.id===hq;
}
