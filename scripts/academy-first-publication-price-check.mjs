import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){if(s==='server-only')return{url:'data:text/javascript,export{}',shortCircuit:true};if(s.startsWith('.')&&!/\.[a-z]+$/i.test(s))return next(`${s}.ts`,c);return next(s,c);}});
const {priceUnits,verifyVariablePrice}=await import('../lib/academy/first-publication-billing/price-contract.ts');
let n=0;function test(name,run){run();console.log(`PASS ${name}`);n++;}
test('fixed bands retain quantity one',()=>{for(const [plan,amount] of [['small',5000],['medium',10000],['large',20000]])assert.deepEqual(priceUnits(plan,amount),{unitAmount:amount,quantity:1});});
test('201 and 250 follow existing formula exactly',()=>{for(const count of [201,250]){const amount=20000+(count-200)*100;assert.deepEqual(priceUnits('variable',amount),{unitAmount:100,quantity:count});}});
test('invalid variable totals have no fallback',()=>{for(const amount of [20000,20101,0,-1,NaN,Infinity])assert.throws(()=>priceUnits('variable',amount));});
const price={billing_scheme:'per_unit',transform_quantity:null,recurring:{usage_type:'licensed'}};
test('licensed per-unit price is supported',()=>assert.doesNotThrow(()=>verifyVariablePrice(price,'variable')));
test('metered tiered and transformed prices fail closed',()=>{assert.throws(()=>verifyVariablePrice({...price,billing_scheme:'tiered'},'variable'));assert.throws(()=>verifyVariablePrice({...price,transform_quantity:{divide_by:10}},'variable'));assert.throws(()=>verifyVariablePrice({...price,recurring:{usage_type:'metered'}},'variable'));});
console.log(`${n} price contract checks passed; no provider calls.`);
