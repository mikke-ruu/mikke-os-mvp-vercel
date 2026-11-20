const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function guestMaterialPath(id,token){if(!uuid.test(id))throw Error('invalid_guest_application');if(token!==undefined&&!/^[a-f0-9]{64}$/.test(token))throw Error('invalid_guest_material_token');return '/academy/guest-materials?application='+id+(token?'#receive='+token:'');}
export function appendGuestMaterialAccess(message,id,enabled,origin,token){
 if(enabled!==true)return message;
 const root=new URL(origin);
 if(root.origin!==origin||!(origin==='https://app.mikke-os.com'||/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)))throw Error('untrusted_guest_material_origin');
 if(!/^[a-f0-9]{64}$/.test(token??''))throw Error('guest_material_token_required');
 const url=root.origin+guestMaterialPath(id,token);
 const text='【教材の受け取り】\n教材を見るときは、お申し込みと同じメールアドレスで登録・ログインしてください。メールアドレスの確認後、次のページで教材を受け取れます。\n'+url+'\n入金確認や受講完了など、講座ごとの条件を満たすと教材をご覧いただけます。';
 return {...message,text:message.text+'\n\n'+text,html:message.html+'<div style="line-height:1.8;margin-top:24px">'+escape(text).replace(/\n/g,'<br>')+'</div>'};
}
