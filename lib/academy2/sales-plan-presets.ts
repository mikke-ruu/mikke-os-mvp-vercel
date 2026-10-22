import type { SalesPlanType } from './sales-plan.mjs';
export const salesPlanChoices = [
 {id:'workshop',kind:'ワークショップ',icon:'WS',description:'体験・イベント・コラボなど、開催日を決めて募集するときに。'},
 {id:'single',kind:'単品講座',icon:'1',description:'ひとつの講座を、そのまま販売したいときに。'},
 {id:'course',kind:'コース',icon:'3',description:'複数の講座を、順番に受講するコースとして販売するときに。'},
 {id:'certification',kind:'認定講座',icon:'認',description:'認定・講師登録・ライセンス・キットなどを設定できます。'},
 {id:'all',kind:'全講座',icon:'全',description:'対象となる講座をまとめて受講できる販売プラン。'},
 {id:'monthly',kind:'月額レッスン',icon:'月',description:'レッスンや会費などを月額で継続して販売します。'},
] as const;
// The other draft types remain readable for existing data, but are not offered in this release.
export const academy2OpenSalesPlanIds = ['workshop','single','course'] as const;
export function isAcademy2OpenSalesPlanId(value:string){return academy2OpenSalesPlanIds.some(id=>id===value);}
export type SalesPlanPreset = typeof salesPlanChoices[number]['id'];
export const salesPlanSamples = [
 {id:'workshop',title:'キャンドル体験ワークショップ',price:5000,summary:'キャンドル基礎'},
 {id:'course',title:'キャンドル基礎3回コース',price:18000,summary:'01 基礎 → 02 実技 → 03 応用'},
 {id:'certification',title:'キャンドル認定講座',price:55000,summary:'3講座・ライセンスあり・キットあり'},
 {id:'monthly',title:'季節のキャンドル 月額レッスン',price:5500,summary:'月額レッスン'},
] as const;
export type SalesPlanSample = typeof salesPlanSamples[number]['id'];
export function parseSalesPlanPreset(value:string|null):SalesPlanPreset|undefined{return salesPlanChoices.find(item=>item.id===value&&isAcademy2OpenSalesPlanId(item.id))?.id;}
export function parseSalesPlanSample(value:string|null):SalesPlanSample|undefined{return salesPlanSamples.find(item=>item.id===value&&isAcademy2OpenSalesPlanId(item.id))?.id;}
export function salesPlanPresetKind(preset:SalesPlanPreset):SalesPlanType{return preset==='certification'?'コース':salesPlanChoices.find(item=>item.id===preset)!.kind as SalesPlanType;}
