import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
registerHooks({resolve(specifier,context,nextResolve){
  if(specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return nextResolve(`${specifier}.ts`,context);
  return nextResolve(specifier,context);
}});
const {resolveAcademyBillingPlan}=await import('../lib/billing/platform/academy-plan.ts');
const now=new Date('2026-09-03T03:00:00.000Z'),hq='a9030000-0000-4000-8000-000000000001';
assert.deepEqual(resolveAcademyBillingPlan(null,'small',null,now),{ok:true,planKey:'small',totalYen:5000});
for(const plan of ['medium','large','custom'])assert.deepEqual(resolveAcademyBillingPlan(null,plan,null,now),{ok:false,reason:'conflict'});
const estimate=(count,price,observed_at=now.toISOString())=>[{registered_instructor_count:count,catalog_price_yen:price,observed_at}];
for(const [count,plan,total] of [[0,'small',5000],[20,'small',5000],[21,'medium',10000],[50,'medium',10000],[51,'large',20000],[200,'large',20000]])
  assert.deepEqual(resolveAcademyBillingPlan(hq,plan,estimate(count,total),now),{ok:true,planKey:plan,totalYen:total});
assert.deepEqual(resolveAcademyBillingPlan(hq,'small',estimate(21,10000),now),{ok:false,reason:'conflict'});
assert.deepEqual(resolveAcademyBillingPlan(hq,'large',estimate(201,20100),now),{ok:false,reason:'variable'});
for(const value of [null,[],[{},{}],estimate(-1,5000),estimate(20,4999),estimate(20,5000,'bad'),estimate(20,5000,'2026-09-03T02:50:00.000Z')])
  assert.deepEqual(resolveAcademyBillingPlan(hq,'small',value,now),{ok:false,reason:'unavailable'});
const server=readFileSync(new URL('../lib/billing/platform/server.ts',import.meta.url),'utf8');
assert.match(server,/academy_get_my_current_billing_estimate/);
assert.match(server,/await selection\(principal,input,signal\)/);
assert.match(server,/selectAuthorizedContext:async[\s\S]*await selection\(principal,raw,nextSignal\)/);
console.log('platform billing Academy server plan contract: ok');
