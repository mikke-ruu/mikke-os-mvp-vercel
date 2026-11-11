export const RECEIPT_V2_BODY='{{name}} 様\n\nこのたびは「{{title}}」にお申し込みいただき、ありがとうございます。\nお申し込みを受け付けましたので、内容とお支払い方法をご案内します。';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function receiptV2(payload,origin){
 const root=new URL(origin);if(root.origin!=='https://app.mikke-os.com'&&!(root.protocol==='http:'&&['127.0.0.1','localhost'].includes(root.hostname)))throw Error('untrusted_origin');
 if(!['bank','external'].includes(payload.method))throw Error('unsupported_payment');
 const base=payload.body_override?.trim()||RECEIPT_V2_BODY;
 const values={name:payload.name,title:payload.title,price:Number(payload.price).toLocaleString('ja-JP')};
 const intro=base.replace(/\{\{(name|title|price)\}\}/g,(_,key)=>values[key]);
 const when=payload.event?.startsAt?new Date(payload.event.startsAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',dateStyle:'long',timeStyle:'short'}):payload.studyStyle==='materials_only'?'教材だけで学ぶ講座':'お申し込み後にご相談';
 let payment;
 if(payload.method==='bank'){
  if(!payload.bank_note?.trim())throw Error('bank_instruction_unavailable');
  payment='【お支払いについて】\n下記の口座へ、販売ページでご案内しているお支払い期限までにお振り込みをお願いいたします。\n\n'+payload.bank_note;
 }else{
  const url=new URL(payload.external_payment_url);if(url.protocol!=='https:'||url.username||url.password)throw Error('invalid_payment_url');
  payment='【お支払いについて】\n以下の決済ページから、お支払いのお手続きをお願いいたします。\n'+url.href;
 }
 const link=path=>path?new URL(path,root).href:null;
 const body=[intro,`【お申し込み内容】\n講座・プラン：${payload.title}\n開催日時・受講方法：${when}\nお支払い金額：${values.price}円`,payment,
  'ご入金を確認しましたら、参加方法や教材のご利用について、あらためてメールでお知らせします。',
  payload.planPath&&`お申し込みの講座・プラン：${link(payload.planPath)}`,
  'ご不明な点や、お申し込み内容に訂正がある場合は、下記のお問い合わせ先へご連絡ください。',
  [payload.headquartersName,payload.contactEmail&&`お問い合わせ：${payload.contactEmail}`,payload.homePath&&`ホームページ：${link(payload.homePath)}`].filter(Boolean).join('\n'),
  '※このメールは自動送信です。このメールへの返信は確認できません。お問い合わせは、上記のメールアドレスへお願いいたします。'
 ].filter(Boolean).join('\n\n');
 const html=escape(body).replace(/https?:\/\/[^\s<]+/g,url=>`<a href="${url}">${url}</a>`).replace(/\n/g,'<br>');
 return {subject:`【Academy】「${String(payload.title).replace(/[\r\n]/g,' ')}」へのお申し込みを受け付けました`,text:body,html:`<div style="font-family:sans-serif;line-height:1.8;max-width:640px;margin:auto;color:#202126">${html}</div>`};
}
