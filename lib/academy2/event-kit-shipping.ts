import {supabase} from '@/lib/supabase/client';
import {assertAcademyWritable} from '@/lib/academy/preview';
export type EventKitShipment={id:string;assignmentRequestId:string;instructorId:string;currentRecipient:boolean;address:string|null;trackingNumber:string|null;destinationRevision:number;kitName:string|null;participants:{key:string;name:string}[];quantity:number;shippedAt:string;recordedAt:string;eventSnapshot:{id:string;title:string};assignmentSnapshot:{requestId:string;instructorId:string;instructorName:string|null}};
export type EventKitShippingView={eventId:string;headquartersId:string;revision:number;applicable:boolean;assignmentRequestId:string|null;destinationRevision:number|null;address:string|null;kitName:string|null;roster:{key:string;name:string}[];rosterToken:string;remainingCount:number;shipments:EventKitShipment[];canRecord:boolean};
export type EventKitShippingInput={assignmentRequestId:string;destinationRevision:number;rosterToken:string;participantKeys:string[];shippedAt:string;trackingNumber:string};
async function call(name:string,args:Record<string,unknown>):Promise<EventKitShippingView>{
 const {data,error}=await supabase.rpc(name,args).abortSignal(AbortSignal.timeout(30_000));
 if(error)throw Object.assign(new Error(error.code==='PT409'?'担当者・発送先・参加者または発送記録が更新されています。入力を残して最新情報を読み、対象を確認してください。'
  :error.code==='42501'?'この開催の発送情報を操作する権限がありません。'
  :error.message==='academy2_target_already_shipped'?'選択した参加者のキットは、この担当者への発送を記録済みです。'
  :error.code==='22023'?'発送先、対象者、発送日時を確認してください。入力内容は残っています。':'発送記録を確認できませんでした。入力内容を残して、もう一度お試しください。'),{code:error.code});
 return data as EventKitShippingView;
}
export const getEventKitShipping=(headquartersId:string,eventId:string)=>call('academy2_event_kit_shipping',{p_headquarters_id:headquartersId,p_event_id:eventId});
export function recordEventKitShipping(headquartersId:string,eventId:string,revision:number,requestId:string,input:EventKitShippingInput){assertAcademyWritable();return call('academy2_record_event_kit_shipping',{p_headquarters_id:headquartersId,p_event_id:eventId,p_expected_revision:revision,p_request_id:requestId,p_input:input});}
