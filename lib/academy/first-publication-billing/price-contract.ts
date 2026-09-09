import 'server-only';
import { demand, object } from './stripe-runtime';
import type { JsonObject } from './stripe-runtime';

export function priceUnits(planKey:string,amountYen:number){
  demand(typeof planKey==='string'&&planKey.length>0&&Number.isSafeInteger(amountYen)&&amountYen>0,'INVALID_PRICE_CONTRACT');
  if(planKey==='variable'){
    demand(amountYen>20000&&amountYen%100===0,'INVALID_VARIABLE_AMOUNT');
    return {unitAmount:100,quantity:amountYen/100};
  }
  return {unitAmount:amountYen,quantity:1};
}
export function verifyVariablePrice(price:JsonObject,planKey:string){
  if(planKey==='variable')demand(price.billing_scheme==='per_unit'&&price.transform_quantity===null&&object(price.recurring)&&price.recurring.usage_type==='licensed','VARIABLE_PRICE_UNSUPPORTED');
}
