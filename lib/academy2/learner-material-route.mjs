// Route selection only. The authenticated materials RPC remains the permission check.
export function ownedLearnerMaterialApplication(view,application){
 return view==='learner'&&typeof application==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(application)?application:null;
}

/** @returns {'v2'|'legacy'|'unavailable'} */
export function ownedLearnerStudySource(materials,application,source,legacyLinks,userId,applicationId){
 if(!application||application.id!==applicationId||application.learner_user_id!==userId||application.status!=='paid')return 'unavailable';
 if(source==='v2')return materials?.applicationId===applicationId?'v2':'unavailable';
 if(source!=='legacy')return 'unavailable';
 return Array.isArray(application.course_ids)&&Array.isArray(legacyLinks)&&legacyLinks.some(link=>application.course_ids.includes(link.course_id))?'legacy':'unavailable';
}
