export type ApplicationDraftInput={name:string;method:string;classId:string;answers:Record<string,string>};
type Storage=Pick<globalThis.Storage,'getItem'|'setItem'|'removeItem'>;
export function readApplicationDraft(storage:Storage,actor:string,offering:string,scope:string,now?:number):ApplicationDraftInput|null;
export function writeApplicationDraft(storage:Storage,actor:string,offering:string,scope:string,values:ApplicationDraftInput,now?:number):boolean;
export function clearApplicationDraft(storage:Storage,actor:string,offering:string):void;
