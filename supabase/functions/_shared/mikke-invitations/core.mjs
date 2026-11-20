const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const invitationApps=Object.freeze(['academy','team-works']);
export function invitationPath(app,id){if(!invitationApps.includes(app)||!uuid.test(id??''))throw new Error('招待の指定が正しくありません。');return `/invitations/${app}/${id}`;}
export const normalizeEmail=value=>String(value??'').trim().toLowerCase();
export async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
export function recipientState(invite,user,now=Date.now()){
 if(!user?.email_confirmed_at)return 'email_unverified';
 if(!user.email||normalizeEmail(invite.email)!==normalizeEmail(user.email))return 'mismatch';
 if(!invite.active)return 'unavailable';
 if(invite.status==='accepted')return invite.recipientActive?'accepted':'unavailable';
 if(invite.status!=='pending')return 'unavailable';
 if(!Number.isFinite(Date.parse(invite.expiresAt))||Date.parse(invite.expiresAt)<=now)return 'expired';
 return 'pending';
}
/** The adapter alone owns app-specific identity, authorization, and membership changes. */
export async function invitationAction({app,id,action,fingerprint,user,adapter,ledger,deliver,enabled=false,now=Date.now()}){
 const path=invitationPath(app,id);
 if(!user?.id||!['inspect','accept','preview','send'].includes(action))throw new Error('招待の操作を確認できませんでした。');
 const invite=await adapter.load(id,user);
 if(!invite)throw new Error('招待情報を確認できませんでした。');
 if(invite.opaque){if(action==='inspect')return {state:invite.opaque,app};throw new Error('この招待を操作できません。');}
 if(action==='inspect'||action==='accept'){
  const state=recipientState(invite,user,now);
  // Neither the private title nor recipient address is exposed to a different/unverified account.
  if(['mismatch','email_unverified'].includes(state)){if(action==='accept')throw new Error('招待されたアカウントでメールアドレスの確認を完了してください。');return {state,app};}
  if(action==='accept'){
   if(state==='accepted')return {state,app,title:invite.title,roleLabel:invite.roleLabel,destination:invite.destination};
   if(state!=='pending')throw new Error('この招待は現在利用できません。状態を再確認してください。');
   await adapter.accept(invite,user);
   const verified=await adapter.load(id,user);
   if(!verified||recipientState(verified,user,now)!=='accepted')throw new Error('参加結果を確認できませんでした。再送せず、状態を確認してください。');
   return {state:'accepted',app,title:verified.title,roleLabel:verified.roleLabel,destination:verified.destination};
  }
  return {state,app,...(['pending','accepted'].includes(state)?{title:invite.title,sender:invite.sender,roleLabel:invite.roleLabel,expiresAt:invite.expiresAt,...(state==='accepted'?{destination:invite.destination}:{})}:{})};
 }
 await adapter.authorizeSender(invite,user);
 if(!invite.active||invite.status!=='pending'||!Number.isFinite(Date.parse(invite.expiresAt))||Date.parse(invite.expiresAt)<=now)throw new Error('参加済み・取消済み・期限切れの招待は送信できません。');
 const content=adapter.content(invite,'https://app.mikke-os.com'+path);
 const expected=await digest(JSON.stringify([app,id,normalizeEmail(invite.email),content]));
 const key=await digest(JSON.stringify([app,id,normalizeEmail(invite.email)]));
 const existing=await ledger.read(key)??(adapter.previousDelivery?await adapter.previousDelivery(invite):invite.previousDelivery);
 if(action==='preview')return {...content,email:invite.email,fingerprint:expected,status:existing?.status??'unsent',canSend:enabled&&!existing};
 if(!enabled)throw new Error('招待メールの送信はまだ有効になっていません。');
 if(fingerprint!==expected)throw new Error('招待内容が変わりました。プレビューを開き直してください。');
 if(existing)return {status:existing.status,sent:existing.status==='sent',duplicate:true};
 const claimed=await ledger.claim({key,app,id,fingerprint:expected});
 if(!claimed){const current=await ledger.read(key);return {status:current?.status??'unknown',sent:current?.status==='sent',duplicate:true};}
 try{
  const result=await deliver({to:invite.email,...content,idempotencyKey:'mikke-invitation-'+key});
  if(!result?.id)throw new Error('provider response unknown');
  await ledger.mark(key,'sent',result.id);
  return {status:'sent',sent:true};
 }catch{
  try{await ledger.mark(key,'unknown');}catch{/* Do not resend even when recording fails. */}
  throw new Error('送信結果を確認できませんでした。重複送信を防ぐため再送を停止しています。');
 }
}
