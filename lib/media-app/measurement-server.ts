import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';

/** Only platform-overwritten connection headers, never an arbitrary client visitor ID. */
export function mediaMeasurementIdentity(headers:Headers,secret:string,platform:'netlify'|'vercel'|'local',day:string){
 const address=platform==='netlify'?headers.get('x-nf-client-connection-ip'):platform==='vercel'?headers.get('x-vercel-forwarded-for')?.split(',')[0].trim():'127.0.0.1';
 if(!address||!isIP(address))return null;
 const sign=(value:string)=>createHmac('sha256',secret).update(`media-measurement:v1:${day}:${value}`).digest('hex');
 const rateKey=sign(`rate:${address}`);
 const digest=sign(`visitor:${address}:${(headers.get('user-agent')??'').slice(0,300)}`);
 return {rateKey,visitor:`${digest.slice(0,8)}-${digest.slice(8,12)}-${digest.slice(12,16)}-${digest.slice(16,20)}-${digest.slice(20,32)}`};
}
