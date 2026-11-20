const prefix='academy-application-input-v1:';
const ttl=30*60*1000;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function key(actor,offering){return uuid.test(actor)&&uuid.test(offering)?prefix+actor+':'+offering:null;}
function fields(value){
 if(!value||typeof value.name!=='string'||value.name.length>120||typeof value.method!=='string'||value.method.length>30||typeof value.classId!=='string'||value.classId!==''&&!uuid.test(value.classId)||!value.answers||Array.isArray(value.answers)||typeof value.answers!=='object')return null;
 const entries=Object.entries(value.answers);if(entries.length>60||entries.some(([id,answer])=>id.length>200||['__proto__','constructor','prototype'].includes(id)||typeof answer!=='string'||answer.length>4000))return null;
 return {name:value.name,method:value.method,classId:value.classId,answers:Object.fromEntries(entries)};
}
/** Tab-session input only. Never cache Auth, email, consent, receipt, or a write token. */
export function readApplicationDraft(storage,actor,offering,scope,now=Date.now()){
 const k=key(actor,offering);if(!k)return null;
 try{const raw=storage.getItem(k);if(!raw||raw.length>250000)return null;const saved=JSON.parse(raw);if(saved.scope!==scope||!Number.isFinite(saved.at)||now-saved.at>ttl||saved.at>now+60000){storage.removeItem(k);return null;}return fields(saved.values);}catch{return null;}
}
export function writeApplicationDraft(storage,actor,offering,scope,values,now=Date.now()){
 const k=key(actor,offering),safe=fields(values);if(!k||!safe||typeof scope!=='string'||scope.length>4000)return false;
 try{storage.setItem(k,JSON.stringify({scope,at:now,values:safe}));return true;}catch{return false;}
}
export function clearApplicationDraft(storage,actor,offering){const k=key(actor,offering);if(k)try{storage.removeItem(k);}catch{}}
