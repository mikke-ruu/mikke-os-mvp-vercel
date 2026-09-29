import type {SalesPlanApplicationField,SalesPlan} from './sales-plan.mjs';
export type ApplicationContext={format:string|null;schedule_mode:string|null;kit_shipping:boolean;certificate:boolean;physical_certificate:boolean;instructor_registration?:boolean;course_ids:string[]};
export type ApplicationEvent={format:string;scheduleMode:string;kitMethod?:string|null};
export type IntakeField=Omit<SalesPlanApplicationField,'type'> & {type:SalesPlanApplicationField['type']|'date'};
export const defaultApplicationFields:SalesPlanApplicationField[];
export function applicationContext(configuration:Partial<Pick<SalesPlan,'study_style'|'kit'|'after'|'course_ids'>>,event?:ApplicationEvent|null,mode?:string):ApplicationContext;
export function conditionMatches(condition:SalesPlanApplicationField['condition'],context:ApplicationContext,answers?:Record<string,string>):boolean;
export function visibleApplicationFields(fields:SalesPlanApplicationField[],context:ApplicationContext,answers?:Record<string,string>):SalesPlanApplicationField[];
export function automaticApplicationFields(context:ApplicationContext):IntakeField[];
export function intakeFields(form:{fields:SalesPlanApplicationField[];conditionalVersion?:number}|undefined,context:ApplicationContext,answers?:Record<string,string>):IntakeField[];
export function projectApplicationAnswers(fields:IntakeField[],answers?:Record<string,string>):Record<string,string>;
export function applicationFormErrors(fields:SalesPlanApplicationField[]):string[];

