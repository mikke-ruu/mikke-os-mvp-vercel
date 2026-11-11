export const shipmentCarriers=[
 ['japan_post_clickpost','日本郵便（クリックポスト）'],
 ['japan_post_letterpack','日本郵便（レターパック）'],
 ['japan_post_yupack','日本郵便（ゆうパック）'],
 ['japan_post_yupacket','日本郵便（ゆうパケット）'],
 ['yamato','ヤマト運輸'],['sagawa','佐川急便'],
 ['other','その他'],['untracked','追跡のない配送（普通郵便など）']
] as const;
export function shipmentCarrierLabel(value:string|null|undefined){
 if(!value)return '未登録';
 return value.startsWith('other:')?value.slice(6):shipmentCarriers.find(([id])=>id===value)?.[1]??'未登録';
}
export function japanDate(value:string|Date=new Date()){
 const date=typeof value==='string'?new Date(value):value;
 return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function paymentMethodLabel(value:string){
 return ({bank:'銀行振込',external:'外部決済サービス',onsite:'当日払い',card:'カード決済',stripe:'カード決済'} as Record<string,string>)[value]??'支払方法の記録を確認してください';
}
