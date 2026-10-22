// Version 1 content is shared by the settings preview and Edge worker.
// Keep this version stable: queued jobs retain their body and rendering version.
export const OPERATIONAL_MAIL_KINDS = Object.freeze(['instructor_registered','instructor_invitation','instructor_linked','instructor_order_headquarters','instructor_order_received']);
export const MAIL_KINDS = Object.freeze(['receipt','headquarters','materials',...OPERATIONAL_MAIL_KINDS]);
export const MAIL_VARIABLES = Object.freeze(['name','title','price','materials_url','applications_url','manager_url','instructor_url','invitation_url','order_url']);
export const MAX_BODY_LENGTH = 4000;
export const MAIL_SUBJECTS = Object.freeze({
  receipt:'【Academy】お申込みを受け付けました',headquarters:'【Academy】新しいお申込みがありました',materials:'【Academy】入金を確認しました',
  instructor_registered:'【Academy】講師登録が完了しました',instructor_invitation:'【Academy】mikke ID連携のご案内',instructor_linked:'【Academy】mikke IDの連携が完了しました',
  instructor_order_headquarters:'【Academy】講座用教材の注文がありました',instructor_order_received:'【Academy】講座用教材の注文を受け付けました'
});
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function DEFAULT_BODIES(kind,paymentMethod='bank') {
  if(kind==='receipt')return '{{name}} 様\n\n{{title}}のお申込みを受け付けました。\n\nお申込み金額：{{price}}円\n\n'+(paymentMethod==='bank'?'お支払いについては本部の案内をご確認ください。お振込みの名義は、お申込みのお名前と同じにしてください。':'お支払いは教室の案内に沿ってお手続きください。');
  if(kind==='headquarters')return '{{title}}に{{name}}さんからお申込みがありました。';
  if(kind==='materials')return '{{name}} 様\n\n{{title}}の入金を確認しました。\n\nお申込み時のmikke IDでログインして、マイページからレッスン内容をご確認ください。公開期間や教室の設定によって、表示される教材は異なります。';
  if(kind==='instructor_registered')return '{{name}} 様\n\n{{title}}の講師登録が完了しました。ご自身のmikke IDでログインして、マイページをご確認ください。';
  if(kind==='instructor_invitation')return '{{name}} 様\n\n{{title}}で講師登録が完了しました。\n\nmikke IDをお持ちでない方は、先に新規登録をお願いします。\n\n下のリンクから、ご自身のmikke IDを講師登録に連携してください。';
  if(kind==='instructor_linked')return '{{name}} 様\n\n{{title}}の講師登録とmikke IDの連携が完了しました。マイページをご確認ください。';
  if(kind==='instructor_order_headquarters')return '{{name}}さんから講座用教材の注文がありました。\n\n{{title}}\n注文金額：{{price}}円\n\n注文内容をご確認ください。';
  if(kind==='instructor_order_received')return '{{name}} 様\n\n講座用教材の注文を受け付けました。\n\n{{title}}\n注文金額：{{price}}円\n\nお支払いと受け取りについては本部の案内をご確認ください。';
  throw Error('invalid_notification_kind');
}

export function validateBody(body) {
  if(body==null)return [];
  if(typeof body!=='string')return ['本文は文章で入力してください。'];
  const errors=[];
  if(Array.from(body).length>MAX_BODY_LENGTH)errors.push('本文は4000文字以内で入力してください。');
  const remainder=body.replace(/\{\{(name|title|price|materials_url|applications_url|manager_url|instructor_url|invitation_url|order_url)\}\}/g,'');
  if(remainder.includes('{{')||remainder.includes('}}'))errors.push('差し込み項目は一覧にあるものをそのまま使ってください。');
  return errors;
}

function content(kind,body,payload,appOrigin) {
  if(!MAIL_KINDS.includes(kind))throw Error('invalid_notification_kind');
  if(validateBody(body).length)throw Error('invalid_notification_body');
  const origin=new URL(appOrigin);
  if(origin.origin!=='https://app.mikke-os.com'&&!(['127.0.0.1','localhost'].includes(origin.hostname)&&origin.protocol==='http:'))throw Error('untrusted_app_origin');
  const hq=String(payload.headquarters_id);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hq))throw Error('invalid_headquarters');
  const operational=OPERATIONAL_MAIL_KINDS.includes(kind);
  const invitation=kind==='instructor_invitation';
  const redacted=invitation&&payload.invitation_redacted===true;
  if(invitation&&!redacted&&!/^[a-f0-9]{64}$/i.test(payload.invitation_token??''))throw Error('invalid_invitation_token');
  const variables={
    name:String(payload.name??''),title:String(payload.title??''),price:String(payload.price??''),
    materials_url:`${origin.origin}/academy/h/${hq}/teach/study?view=learner`,
    applications_url:`${origin.origin}/academy/h/${hq}/teach/offering-applications/mine`,
    manager_url:`${origin.origin}/academy/h/${hq}/manage/offering-applications`,
    instructor_url:`${origin.origin}/academy/h/${hq}/teach?view=instructor`,
    invitation_url:invitation?(redacted?'招待リンクはログに表示しません':`${origin.origin}/academy/instructor-invitation/${payload.invitation_token}`):'',
    order_url:`${origin.origin}/academy/h/${hq}/${kind==='instructor_order_headquarters'?'manage':'teach'}/kits`
  };
  const custom=typeof body==='string'&&body.trim()!=='';
  const template=custom?body:DEFAULT_BODIES(kind,payload.payment_method);
  // Single pass: names/titles containing {{...}} are never expanded a second time.
  const text=template.replace(/\{\{(name|title|price|materials_url|applications_url|manager_url|instructor_url|invitation_url|order_url)\}\}/g,(_match,key)=>variables[key]);
  const order=kind==='instructor_order_headquarters'||kind==='instructor_order_received';
  const link=operational?(invitation?variables.invitation_url:order?variables.order_url:variables.instructor_url):kind==='headquarters'?variables.manager_url:kind==='materials'?variables.materials_url:variables.applications_url;
  const linkLabel=operational?(invitation?'mikke ID連携の案内を確認する':order?'教材の注文を確認する':'講師のマイページを確認する'):kind==='materials'?'マイページで教材を確認する':'申込を確認する';
  // The authoritative amount remains visible even when a custom body omits {{price}}.
  const amount=custom&&(kind==='receipt'||order)?`${order?'注文金額':'お申込み金額'}：${variables.price}円`:null;
  return {text,link,linkLabel,amount,redacted,reference:`${operational?'通知番号':'受付番号'}：${String(operational?payload.source_id??'':payload.application_id??'')}`};
}

export function renderPlainBody(kind,body,payload,appOrigin='https://app.mikke-os.com') {
  const c=content(kind,body,payload,appOrigin);
  return [c.text,c.amount,`${c.linkLabel}\n${c.link}`,c.reference].filter(Boolean).join('\n\n');
}

export function renderHtmlBody(kind,body,payload,appOrigin='https://app.mikke-os.com') {
  const c=content(kind,body,payload,appOrigin);
  const paragraphs=c.text.replace(/\r\n?/g,'\n').split(/\n\n+/).map(p=>`<p>${escape(p).replaceAll('\n','<br />')}</p>`).join('');
  return `<div lang="ja">${paragraphs}${c.amount?`<p>${escape(c.amount)}</p>`:''}<p>${c.redacted?escape(c.link):`<a href="${escape(c.link)}">${escape(c.linkLabel)}</a>`}</p><p>${escape(c.reference)}</p></div>`;
}

// Old jobs predate body overrides. Ignore any current settings when reviewing them.
export function renderSnapshotPlainBody(kind,payload,appOrigin='https://app.mikke-os.com') {
  if(payload.mail_content_version==null)return renderPlainBody(kind,null,payload,appOrigin);
  if(payload.mail_content_version===1||payload.mail_content_version===2)return renderPlainBody(kind,payload.body_override,payload,appOrigin);
  throw Error('unsupported_mail_content_version');
}
