import {toAcademyContextHref} from '@/lib/academy/access-context';
import type {SalesPlanPublicationState} from './sales-plan-catalog';
export function publicationSummary(value:SalesPlanPublicationState|null){
 if(!value||!['published','not_published','archived'].includes(value.state))return {label:'公開状態を確認できません',description:'最新の状態を確認してください。'};
 if(value.state==='published')return value.has_unpublished_changes?{label:'公開中・変更は未反映',description:'保存した変更は、公開ページにまだ反映されていません。'}:{label:'公開中',description:'申込みの受付状況は、公開ページで確認できます。'};
 return {label:value.state==='archived'?'非公開':'未公開',description:'販売ページを確認してから公開できます。'};
}
/** Navigation only. Server readiness and publication commands remain authoritative. */
export function publicationFix(reason:string,hq:string,plan:string,eventId?:string){
 const base=toAcademyContextHref('/academy/offerings/'+plan,hq,'manage'),review=base+'?preview=standard';
 const step=(n:number)=>base+'?step='+n;
 const settings=(tab:string)=>toAcademyContextHref('/academy/settings',hq,'manage')+'?tab='+tab+'&return='+encodeURIComponent(review);
 const event=eventId?toAcademyContextHref('/academy/classes/'+eventId,hq,'manage'):toAcademyContextHref('/academy/classes/new',hq,'manage')+'?plan='+encodeURIComponent(plan);
 const choices:Record<string,{label:string;href:string}>={
 application_terms_required:{label:'申込規約を設定する',href:step(5)},title_or_price_required:{label:'名前・料金を設定する',href:step(3)},teaching_method_required:{label:'受講方法を設定する',href:step(2)},six_step_review_settings_pending:{label:'講座の設定を確認する',href:step(1)},bank_transfer_instructions_required:{label:'振込先を登録する',href:settings('payment')},seller_disclosure_required:{label:'販売者情報・規約を確認する',href:settings('terms')},existing_public_contract_required:{label:'利用契約を確認する',href:settings('billing')},event_required:{label:eventId?'開催内容を確認する':'開催日程を登録する',href:event},event_not_ready:{label:'開催内容を確認する',href:event},event_revision_changed:{label:'開催と販売内容を確認する',href:event},revision_changed:{label:'保存内容を読み直す',href:review},page_needs_rebase:{label:'販売ページを編集する',href:base+'?preview=builder'}};
 return choices[reason]??null;
}
