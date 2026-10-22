export type BankFields=Record<'bank'|'branch'|'type'|'number'|'holder',string>;
export const BANK_FIELDS:readonly {key:keyof BankFields;label:string}[];
export const DEFAULT_BANK_GUIDE:string;
export function emptyBankFields():BankFields;
export function formatBankNote(fields:Record<string,string>,guide:string):string;
export function parseBankNote(note:unknown):{fields:BankFields;guide:string}|null;
export function bankNoteReady(note:unknown):boolean;
