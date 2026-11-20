export type GuestMail={to:string;subject:string;text:string;html:string};
export type GuestMailOutcome={state:'sent';providerId:string}|{state:'unknown'|'failed'};

/** Called only after an atomic, durable claim. Never retries an ambiguous provider result. */
export async function deliverGuestMail(mail:GuestMail,applicationId:string,options:{mode:'capture'|'provider';captureKey?:string;capturePort?:57887|57888;apiKey?:string;from?:string;fetcher?:typeof fetch}):Promise<GuestMailOutcome>{
 const fetcher=options.fetcher??fetch;
 try{
  if(options.mode==='capture'){
   if(!mail.to.endsWith('.invalid')||!options.captureKey)return {state:'failed'};
   const response=await fetcher('http://127.0.0.1:'+(options.capturePort===57888?57888:57887)+'/capture',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+options.captureKey},body:JSON.stringify({...mail,idempotencyKey:'academy-guest-receipt-'+applicationId}),signal:AbortSignal.timeout(10000)});
   return response.ok?{state:'sent',providerId:'local-capture:'+applicationId}:{state:'failed'};
  }
  if(!options.apiKey||!options.from)return {state:'failed'};
  const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+options.apiKey,'Idempotency-Key':'academy-guest-receipt-'+applicationId},body:JSON.stringify({from:options.from,to:mail.to,subject:mail.subject,text:mail.text,html:mail.html}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)return {state:[400,401,403,422,429].includes(response.status)?'failed':'unknown'};
  const body=await response.json();
  return typeof body?.id==='string'&&body.id.length>0?{state:'sent',providerId:body.id}:{state:'unknown'};
 }catch{return {state:'unknown'};}
}
