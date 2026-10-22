// Human-readable serialization for the existing default_payment_note text contract.
// Legacy free text is never guessed or converted on load.
export const BANK_FIELDS = Object.freeze([
  {key:'bank',label:'銀行名'}, {key:'branch',label:'支店名'},
  {key:'type',label:'口座種別'}, {key:'number',label:'口座番号'}, {key:'holder',label:'口座名義'}
]);
export const DEFAULT_BANK_GUIDE = 'お申し込みありがとうございます。\n\n受講料は、以下の口座へお振り込みください。\n\nお振り込みの際は、お申し込み時のお名前でお願いいたします。\n\nご入金を確認後、受講のご案内をいたします。';
export function emptyBankFields(){return Object.fromEntries(BANK_FIELDS.map(f=>[f.key,'']));}
export function formatBankNote(fields,guide){
  const values=BANK_FIELDS.map(f=>String(fields[f.key]??'').trim());
  if(values.some(v=>/[\r\n]/.test(v)))throw Error('振込先の各項目は1行で入力してください。');
  // The guide precedes the account, so "以下の口座" remains correct in mail snapshots.
  return '【お客様へのご案内】\n'+guide+'\n\n【銀行振込先】\n'+BANK_FIELDS.map((f,i)=>f.label+'：'+values[i]).join('\n');
}
export function parseBankNote(note){
  if(typeof note!=='string'||!note.startsWith('【お客様へのご案内】\n'))return null;
  const split=note.lastIndexOf('\n\n【銀行振込先】\n');if(split<0)return null;
  const lines=note.slice(split+'\n\n【銀行振込先】\n'.length).split('\n');if(lines.length!==BANK_FIELDS.length)return null;
  const fields=emptyBankFields();
  for(const[i,f]of BANK_FIELDS.entries()){const prefix=f.label+'：';if(!lines[i].startsWith(prefix))return null;fields[f.key]=lines[i].slice(prefix.length);}
  return {fields,guide:note.slice('【お客様へのご案内】\n'.length,split)};
}
export function bankNoteReady(note){const parsed=parseBankNote(note);return !!parsed&&note.length<=4000&&BANK_FIELDS.every(f=>parsed.fields[f.key].trim());}
