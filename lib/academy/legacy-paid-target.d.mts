export type LegacyPaidTargetScope={enabled:boolean;headquartersId:string;ownerUserId:string};
export type LegacyPaidRecord={id:string;owner_user_id:string;updated_at:string};
export type LegacyPaidAccess={headquarters_id:string;access_kind:string;status:string;can_manage_drafts:boolean;can_use_live_features:boolean;ends_at?:string|null};
export function matchesLegacyPaidTarget(scope:LegacyPaidTargetScope|null,userId:string,headquartersId:string|null|undefined):boolean;
export function createLegacyPaidTargetAdapter<T extends LegacyPaidRecord>(scope:LegacyPaidTargetScope,deps:{getUser:()=>Promise<{id:string;is_anonymous?:boolean}|null>;getHeadquarters:(id:string,userId:string)=>Promise<T|null>;getAccess:(id:string)=>Promise<LegacyPaidAccess|null>;updateProfile:(id:string,patch:Record<string,unknown>)=>Promise<T>;now:()=>number}):{read:()=>Promise<T>;saveFront:(patch:Record<string,unknown>)=>Promise<T>;saveBankNote:(note:string)=>Promise<T>};
