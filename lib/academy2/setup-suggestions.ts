import type {HeadquartersDocumentKind, HeadquartersSettings} from './headquarters-settings';
import type {SellerDocument} from './seller-disclosure';
import {headquartersDocumentTemplate} from './headquarters-document-templates';

// Examples are opt-in draft edits. They are never saved or published on selection.
export const sellerExamples:Partial<Record<keyof SellerDocument,readonly string[]>> = {
 additional_fees:['銀行振込の手数料はお客様のご負担となります。','受講料以外の費用はかかりません。','材料キットの送料は、各販売ページに表示します。'],
 payment_deadline:['お申し込みから7日以内にお支払いください。','お申し込みから3日以内にお支払いください。','お申し込みから14日以内にお支払いください。'],
 provision_timing:['開催日時はお申し込み後に個別に相談します。材料キットは開催前に発送します。','販売ページに記載した日時に開催します。','教材は入金確認後にマイページからご覧いただけます。'],
};
export const bankExamples:Record<string,string>={bank:'例：〇〇銀行',branch:'例：〇〇支店',number:'例：0123456',holder:'例：カ）〇〇'};

/** Fill only a new draft with saved facts. Existing documents never pass through here. */
export function newHeadquartersDocumentDraft(kind:HeadquartersDocumentKind,settings:HeadquartersSettings,seller:SellerDocument|null,paymentPreference?:{useBank:boolean|null}){
 let body=headquartersDocumentTemplate(kind);
 const facts:Record<string,string|undefined>={
  '販売事業者名（法人名または個人事業者名）':seller?.legal_name,
  '運営責任者名':seller?.representative,'所在地':seller?.postal_address,
  '電話番号':seller?.contact_phone,'メールアドレス':seller?.contact_email,
  '受講料以外に必要な費用':seller?.additional_fees,
  '支払方法・支払時期':seller?.payment_deadline,'サービス提供時期':seller?.provision_timing,
 };
 if(seller?.legal_name?.trim())body=body.replaceAll('[販売事業者名を入力]',()=>seller.legal_name);
 if(kind==='commerce')for(const [label,value]of Object.entries(facts)){
  if(value?.trim())body=body.replace(new RegExp('^'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'：\\[[^\\]\\n]*\\]$','m'),()=>label+'：'+value);
 }
 if(kind==='commerce'&&seller?.business_type==='individual'&&!seller.representative?.trim())body=body.replace(/^運営責任者名：\[[^\]\n]*\]\n/m,'');
 if(kind==='application'){
  if(seller?.payment_deadline?.trim())body=body.replace('支払方法・支払時期：[実際の販売条件を入力]',()=>`支払方法・支払時期：${seller.payment_deadline}`);
  if(seller?.provision_timing?.trim())body=body.replace('サービス提供時期・日程相談の方法：[入力]',()=>`サービス提供時期・日程相談の方法：${seller.provision_timing}`);
  const contact=seller?.contact_email||settings.basic.contact_email;
  if(contact?.trim())body=body.replace('連絡先・対応方法：[入力]',()=>`連絡先・対応方法：${contact}`);
 }
 // New drafts only. Do not imply that a configurable access expiry exists.
 if(kind==='application')body=body.replace('教材の利用条件・閲覧期間：[教材を提供する場合に入力]','教材の提供：[教材の有無を選択]');
 const cancellation=settings.documents.find(doc=>doc.kind==='cancellation')?.body;
 if(cancellation?.trim()&&!unfinishedTemplateFields(cancellation).length){
  body=body.replace('[キャンセル・返金ポリシーと一致する内容を入力]',()=>`\n${cancellation}`)
   .replace('[取消・変更・中途解約等の条件と窓口を入力]',()=>`\n${cancellation}`);
 }
 if(kind==='commerce')body=body.replace('[各販売ページの実際の税込価格との対応を入力]','各販売ページに税込価格を表示します。');
 if(kind==='commerce')body=body.replace('申込期間：[期限を設ける場合に入力]','申込期間：各販売ページに表示します。期限を設けない募集は、受付停止までお申し込みいただけます。');
 if(kind==='application'||kind==='commerce'){
  const other=settings.documents.find(doc=>doc.kind===(kind==='application'?'commerce':'application'))?.body;
  const methods=other?.split('\n').find(line=>line.startsWith('お支払方法：'))?.slice('お支払方法：'.length);
  const savedMethod=methods&&!unfinishedTemplateFields(methods).length?methods:paymentPreference?.useBank===true?'各販売ページに表示する支払方法をご利用ください。銀行振込の場合は、お申し込み後に振込先をご案内します。':paymentPreference?.useBank===false?'各販売ページに表示する支払方法をご利用ください。銀行振込は利用しません。':null;
  body=body.replace('支払方法・支払時期：',()=>`お支払方法：${savedMethod??'[利用する支払方法を選択]'}\n支払時期：`);
 }
 if(kind==='privacy'&&seller?.contact_email?.trim())body=body.replace('受付窓口・手続：[入力]',()=>`受付窓口：${seller.contact_email}\n手続：[お問い合わせ後の手続を入力]`);
 if(kind==='cancellation')body+='\n\nキット・物品のキャンセル・返品\n発送前後の扱い・返送費用・不良品への対応：[キット・物品の対応を入力]';
 // Distinct fields must never share the generic [入力] answer.
 body=body.split('\n').map(line=>line.replace(/\[[^\]\n]+\]/g,token=>token==='[入力]'?`[${line.split('：')[0]}を入力]`:token)).join('\n');
 return body;
}

export function unfinishedTemplateFields(body:string){
 return [...new Set(body.match(/\[(?:入力|[^\]\n]*(?:入力|選択))\]/g)??[])];
}

export type DocumentQuestion={token:string;label:string;examples:readonly string[]};
const questionHints:Record<string,{label:string;examples?:readonly string[]}>={
 '教材の提供':{label:'教材を用意していますか？',examples:['教材を提供する場合は、内容と利用方法を各販売ページでご案内します。','教材の内容と提供方法は、各販売ページに表示します。']},
 'お支払方法':{label:'どのお支払方法を案内しますか？',examples:['銀行振込。振込先はお申し込み後にご案内します。','銀行振込、または各販売ページに表示する外部決済。']},
 '受付方法・受付期限':{label:'キャンセルは、どこに・いつまで連絡してもらいますか？',examples:['開催日の7日前までに、お問い合わせ先メールアドレスへご連絡ください。','開催日の3日前までに、お問い合わせ先メールアドレスへご連絡ください。']},
 '返金の可否・金額・手数料':{label:'お客様がキャンセルした場合、返金をどう扱いますか？',examples:['キャンセルによる返金の可否・金額は、各販売ページに表示する条件に従います。手数料が発生する場合も、申込前に販売ページでご案内します。']},
 '変更の受付方法・期限・費用':{label:'日程変更は、いつまで・どの条件で受け付けますか？',examples:['日程変更をご希望の場合は、開催前にお問い合わせ先へご連絡ください。変更できる日程と、追加費用の有無をご案内します。']},
 '連絡方法と対応':{label:'本部の都合で中止・延期するときは、どう対応しますか？',examples:['本部の都合で中止・延期する場合は、ご登録の連絡先へご案内します。振替または返金について、個別にご相談します。']},
 '返金方法・返金時期・問い合わせ先':{label:'返金する場合の方法・時期・連絡先を教えてください。',examples:['返金が必要な場合は、お問い合わせ先へご連絡ください。返金方法と時期は、内容を確認したうえでご案内します。']},
 '申込期間':{label:'申込期限はどこで案内しますか？',examples:['各販売ページに表示します。期限を設けない募集は、受付停止までお申し込みいただけます。']},
 '氏名・連絡先等':{label:'申込時に集める情報と、その使い道を教えてください。',examples:['お名前・メールアドレスなど、申込時に入力された情報を、申込確認・受講案内・お問い合わせへの対応に使用します。']},
 '配送先等':{label:'キットなどの発送で集める情報と、その使い道を教えてください。',examples:['キットなどの発送が必要な場合に、お届け先の情報を取得し、発送と配送に関するご連絡に使用します。']},
 '利用する委託先・第三者提供・外国への移転の有無と対応':{label:'申込情報を扱うサービスや、外部への共有について教えてください。',examples:['申込受付や教室運営に必要な範囲で、利用するシステムや配送サービスに情報の取り扱いを委託する場合があります。利用するサービスと情報の取り扱いを確認し、必要な範囲で利用します。']},
 '保管期間・削除の取扱い':{label:'受講者の情報をいつまで保管し、削除の依頼にどう対応しますか？',examples:['受講対応やお問い合わせ対応に必要な期間、情報を保管します。保管が不要になった情報は、法令上の保存が必要なものを除き、適切に削除します。']},
 '安全管理措置':{label:'情報を守るために行っていることを教えてください。',examples:['情報を確認できる担当者を必要な範囲に限り、アカウントや保存先を適切に管理します。']},
 '手続':{label:'情報の確認・変更・削除のお問い合わせに、どのように対応しますか？',examples:['お問い合わせ先へご連絡ください。ご本人であることを確認したうえで、内容を確認し、対応方法をご案内します。']},
 '発送前後の扱い・返送費用・不良品への対応':{label:'キット・物品のキャンセルや返品は、どう対応しますか？',examples:['キット・物品を提供する場合は、発送前後のキャンセル・返品条件を販売ページでご案内します。']},
 '支払時期':{label:'いつまでにお支払いしてもらいますか？',examples:sellerExamples.payment_deadline},
 'サービス提供時期・日程相談の方法':{label:'開催日や教材のお渡し時期は、どのように案内しますか？',examples:['開催日時や教材のお渡し時期は、各販売ページに表示します。個別の日程相談が必要な場合は、お申し込み後にご連絡します。']},
 'サービス提供時期':{label:'いつ受講・教材利用ができるか、どのように案内しますか？',examples:['受講日程や教材のお渡し時期は、各販売ページに表示します。']},
 '連絡先・対応方法':{label:'お問い合わせは、どこで受け付けますか？',examples:['本部のお問い合わせ先へメールでご連絡ください。内容を確認してご案内します。']},
 '受講料以外に必要な費用':{label:'受講料以外に必要な費用はありますか？',examples:['受講料以外に必要な費用がある場合は、各販売ページに表示します。']},
};
/** Ask only for tokens still missing from this draft; saved facts are already rendered. */
export function documentQuestions(body:string):DocumentQuestion[]{
 return unfinishedTemplateFields(body).map(token=>{
  const line=body.split('\n').find(value=>value.includes(token))??token;
  const label=line.split('：')[0];const hint=questionHints[label];
  return {token,label:hint?.label??`${label}を教えてください。`,examples:hint?.examples??[`${label}については、各販売ページに表示する条件に従います。`]};
 });
}
export function answerDocumentQuestions(body:string,answers:Record<string,string>){
 return body.replace(/\[[^\]\n]+\]/g,token=>answers[token]?.trim()||token);
}

/** Suggested text exists only in a new unsaved draft. Saved policy text is never rewritten. */
export function initialDocumentAnswers(body:string){
 return Object.fromEntries(documentQuestions(body).filter(question=>question.examples.length>0).map(question=>[question.token,question.examples[0]]));
}
