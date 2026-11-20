import {supabase} from '@/lib/supabase/client';
export type InvitationApp='academy'|'team-works';
export type InvitationView={app:InvitationApp;state:'pending'|'accepted'|'expired'|'unavailable'|'mismatch'|'email_unverified';title?:string;sender?:string;roleLabel?:string;expiresAt?:string;destination?:string};
export type InvitationMailPreview={subject:string;html:string;text:string;email:string;fingerprint:string;status:'unsent'|'sending'|'sent'|'unknown';canSend:boolean};
export async function invitationRequest<T>(app:InvitationApp,id:string,action:'inspect'|'accept'|'preview'|'send',fingerprint?:string):Promise<T>{
 const {data,error}=await supabase.functions.invoke('mikke-invitations',{body:{app,id,action,...(fingerprint?{fingerprint}:{})}});
 if(error)throw new Error('招待の処理結果を確認できませんでした。状態を再確認してください。');
 if(!data||data.error)throw new Error(data?.error??'招待の情報を確認できませんでした。');
 if(action==='inspect'||action==='accept'){
  if(data.app!==app||!['pending','accepted','expired','unavailable','mismatch','email_unverified'].includes(data.state)||(['pending','accepted'].includes(data.state)&&(typeof data.title!=='string'||typeof data.roleLabel!=='string')))throw new Error('招待の表示内容を確認できませんでした。');
 }else if(action==='preview'){
  if(typeof data.email!=='string'||typeof data.subject!=='string'||typeof data.html!=='string'||typeof data.text!=='string'||typeof data.fingerprint!=='string'||typeof data.canSend!=='boolean'||!['unsent','sending','sent','unknown'].includes(data.status))throw new Error('メールの確認内容を取得できませんでした。');
 }else if(typeof data.sent!=='boolean'||!['sending','sent','unknown'].includes(data.status))throw new Error('送信結果を確認できませんでした。');
 return data as T;
}
/** Destinations are restricted to the adapter's own app, never an arbitrary next URL. */
export function safeInvitationDestination(app:InvitationApp,value:string|undefined):string|null{
 if(!value||value.includes('\\')||/[\u0000-\u0020]/.test(value))return null;
 if(app==='academy')return /^\/academy\/h\/[0-9a-f-]{36}\/manage\/?$/i.test(value)?value:null;
 return /^\/apps\/team-works\/(?:portal\/(?:client|worker)|projects)\/?$/.test(value)?value:null;
}
