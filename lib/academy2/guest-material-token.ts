import 'server-only';
import {createHmac} from 'node:crypto';
export function guestMaterialToken(id:string,session:string,secret:string){
 if(!secret||secret.length<32||!session||!id)throw Error('guest_material_secret_unavailable');
 return createHmac('sha256',secret).update('academy-guest-material-v1\0'+id+'\0'+session).digest('hex');
}
