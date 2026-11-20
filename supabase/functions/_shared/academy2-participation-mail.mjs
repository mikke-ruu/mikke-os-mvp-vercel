// Local candidate. Delivery is injected; this module never contacts a provider itself.
const text=value=>String(value??'').trim();
export function participationMail(payload,links){
 const event=payload.event??{},name=text(payload.name),title=text(payload.title);
 const when=event.startsAt?new Date(event.startsAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',dateStyle:'long',timeStyle:'short'}):null;
 const details=payload.studyStyle==='materials_only'?
  '教材のご利用についてご案内します。\n'+(links.study?`教材はこちらからご確認ください：${links.study}`:'教材の公開時期やご利用方法は、お申し込みの販売ページをご確認ください。'):
  when?[
  '当日の参加についてご案内します。以下の内容をご確認ください。',
  `開催日時：${when}`,
  ...(event.format==='online'?(event.meetingUrl?[`オンライン参加URL：${event.meetingUrl}`]:['オンライン参加方法は、担当者から別途ご案内します。']):[event.venueName&&`会場：${event.venueName}`,event.address&&`住所：${event.address}`]),
  event.note,'当日お会いできることを楽しみにしております。'
 ].filter(Boolean).join('\n\n'):'開催日程は、これからご相談のうえ決定します。\n担当者からご登録のメールアドレスへご連絡しますので、日程のご相談をお願いいたします。';
 return {subject:`【Academy】ご入金を確認しました｜${title.replace(/[\r\n]/g,' ')}`,
  body:[`${name}様`,`「${title}」の受講料${Number(payload.price).toLocaleString('ja-JP')}円のご入金を確認しました。\nお手続きいただき、ありがとうございます。`,details,
   payload.guestApplicationId&&links.study&&'教材を見るときは、お申し込みと同じメールアドレスで登録・ログインしてください。メールアドレスの確認後に教材を受け取れます。',
   payload.guestApplicationId&&links.study&&payload.studyStyle!=='materials_only'&&`教材の受け取り：${links.study}`,
   links.plan&&`お申し込みの講座・プラン：${links.plan}`,
   'ご不明な点や、ご案内内容に訂正がある場合は、下記のお問い合わせ先へご連絡ください。',
   [payload.headquartersName,payload.contactEmail&&`お問い合わせ：${payload.contactEmail}`,links.home&&`ホームページ：${links.home}`].filter(Boolean).join('\n'),
   '※このメールは自動送信です。このメールへの返信は確認できません。お問い合わせは、上記のお問い合わせ先へお願いいたします。'
  ].filter(Boolean).join('\n\n')};
}
/** Adapter must report rejected only when the provider definitely did not accept delivery. */
export async function deliverParticipationMail(client,jobId,deliver,makeLinks){
 const claim=await client.rpc('academy2_claim_participation_mail',{p_job:jobId});
 if(claim.error)throw claim.error;
 if(claim.data?.outcome!=='claimed')return claim.data?.outcome;
 const {token,payload,idempotencyKey}=claim.data;
 let result='unknown';
 try{
  const response=await deliver({to:payload.email,...participationMail(payload,await makeLinks(payload)),idempotencyKey});
  if(response?.status==='accepted'&&response.messageId)result='sent';
  else if(response?.status==='rejected')result='failed';
 }catch{/* A timeout may have happened after acceptance. Never blindly resend. */}
 const finish=await client.rpc('academy2_finish_participation_mail',{p_job:jobId,p_token:token,p_result:result});
 if(finish.error)throw finish.error;
 return result;
}
