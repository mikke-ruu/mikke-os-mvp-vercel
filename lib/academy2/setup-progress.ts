import type {HeadquartersSetupApi} from './headquarters-setup-api';
import type {HeadquartersSettings} from './headquarters-settings';
import type {SellerProfile} from './seller-disclosure';
import {bankNoteReady} from './bank-note.mjs';
import {unfinishedTemplateFields} from './setup-suggestions';
export type BankPreference={useBank:boolean|null;revision:number};
export type SetupSnapshot={settings:HeadquartersSettings;seller:SellerProfile;basicSaved:boolean;bank:BankPreference};
export function setupProgress(value:SetupSnapshot){
 const {settings,seller,bank}=value;
 const docs=['application','commerce','cancellation','privacy'];
 const rows=[
 {label:'本部情報',step:0,done:value.basicSaved&&!!settings.basic.name.trim()},
 {label:'販売者情報',step:1,done:!!seller.document&&seller.document.publication_consent===true&&Number.isSafeInteger(seller.revision)&&(seller.revision??0)>0&&Array.isArray(seller.missing)&&!seller.missing.filter(k=>!['cancellation','privacy','commerce'].includes(k)).length},
 {label:'お支払い',step:2,done:Number.isSafeInteger(bank.revision)&&bank.revision>0&&(bank.useBank===false||bank.useBank===true&&bankNoteReady(settings.basic.default_payment_note))},
 ...docs.map(kind=>{const d=settings.documents.find(d=>d.kind===kind);return {label:({application:'共通申込規約',commerce:'特定商取引法に基づく表記',cancellation:'キャンセル・返金ポリシー',privacy:'プライバシーポリシー'} as Record<string,string>)[kind],step:3,done:!!d&&Number.isSafeInteger(d.revision)&&d.revision>0&&!!d.version?.trim()&&!!d.body?.trim()&&!unfinishedTemplateFields(d.body).length};})];
 const complete=rows.every(r=>r.done);
 return {rows,complete,firstIncomplete:rows.find(r=>!r.done)?.step??4,state:complete?'complete' as const:(value.basicSaved||bank.revision>0||(seller.revision??0)>0||settings.documents.length>0||!!settings.basic.contact_email?.trim()||!!settings.basic.tagline?.trim())?'partial' as const:'new' as const};
}
export async function readSetupSnapshot(api:HeadquartersSetupApi,hq:string):Promise<SetupSnapshot>{
 const [settings,seller,status,bank]=await Promise.all([api.getSettings(hq),api.getSeller(hq),api.getOnboarding(hq),api.getBankPreference(hq)]);
 return {settings,seller,basicSaved:status.basicSaved,bank};
}
export const setupLabels={new:'本部の初期設定を始めましょう',partial:'本部の初期設定の続きをしましょう',complete:'本部の初期設定は完了しています',error:'設定状況を確認できませんでした'};
