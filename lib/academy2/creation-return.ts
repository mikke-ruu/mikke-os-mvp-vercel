/** Creation return targets must remain inside the same headquarters. */
export function safeCreationReturn(raw:string|null|undefined,headquartersId:string):string|null {
 if(!raw?.startsWith('/')||raw.startsWith('//')||/[\\\r\n]/.test(raw))return null;
 try{const url=new URL(raw,'https://academy.invalid');if(url.origin!=='https://academy.invalid'||url.pathname!==`/academy/h/${headquartersId}/manage/create`)return null;return url.pathname+url.search+url.hash;}catch{return null;}
}
