export function ownedLearnerMaterialApplication(view:string|null,application:string|null):string|null;
export function ownedLearnerStudySource(
  materials:{applicationId?:string}|null,
  application:{id:string;learner_user_id:string;status:string;course_ids:string[]}|null,
  source:'v2'|'legacy'|null,
  legacyLinks:Array<{course_id:string}>|null,
  userId:string,
  applicationId:string,
):'v2'|'legacy'|'unavailable';
