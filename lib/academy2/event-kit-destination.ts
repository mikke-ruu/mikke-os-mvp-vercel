import {supabase} from '@/lib/supabase/client';
import {assertAcademyWritable} from '@/lib/academy/preview';
export type EventKitDestinationView={requestId:string;applicable:boolean;canSelect:boolean;revision:number;selectedAddressId:string|null;selectedAddress:string|null;selectedAt:string|null;options:{id:string;label:string;address:string}[]};
async function call(name:string,args:Record<string,unknown>):Promise<EventKitDestinationView>{const {data,error}=await supabase.rpc(name,args);if(error)throw new Error(error.code==='PT409'?'発送先の指定が更新されています。再読み込みして確認してください。':error.code==='42501'?'この開催の担当情報と発送先を確認できません。':'キットの発送先を確認できませんでした。');return data as EventKitDestinationView;}
export const getEventKitDestination=(requestId:string)=>call('academy2_event_kit_destination',{p_request:requestId});
export function saveEventKitDestination(requestId:string,addressId:string,revision:number,commandId:string){assertAcademyWritable();return call('academy2_save_event_kit_destination',{p_request:requestId,p_address:addressId,p_expected:revision,p_command:commandId});}
