import assert from 'node:assert/strict';
import {participationMail,deliverParticipationMail} from './participation-mail.mjs';
const payload={name:'受講者',email:'learner@example.invalid',title:'確認講座',price:5500,headquartersName:'確認本部',contactEmail:'help@example.invalid',event:{startsAt:'2027-02-20T01:00:00Z',format:'online',meetingUrl:'https://example.invalid/meeting'}};
const message=participationMail(payload,{home:'https://example.invalid/home',plan:'https://example.invalid/plan'});
assert(message.body.includes('オンライン参加URL：https://example.invalid/meeting'));
assert(message.body.includes('お問い合わせ：help@example.invalid'));
assert(message.body.includes('このメールは自動送信です'));
assert(participationMail({...payload,event:{}},{}).body.includes('日程のご相談'));
assert(!participationMail({...payload,event:{},studyStyle:'materials_only'},{}).body.includes('日程のご相談'));
assert(participationMail({...payload,event:{startsAt:payload.event.startsAt,format:'in_person',venueName:'確認会場',address:'確認住所'}},{}).body.includes('住所：確認住所'));
for(const [delivery,expected] of [[{status:'accepted',messageId:'test'},'sent'],[{status:'rejected'},'failed'],[{},'unknown'],[null,'unknown']]){
 let finish;
 const client={rpc:async(name,args)=>name.includes('claim')?{data:{outcome:'claimed',token:'test-token',payload,idempotencyKey:'stable-key'}}:(finish=args,{})};
 assert.equal(await deliverParticipationMail(client,'test-job',async()=>delivery,async()=>({})),expected);
 assert.equal(finish.p_result,expected);
}
let delivered=false;
assert.equal(await deliverParticipationMail({rpc:async()=>({data:{outcome:'sent'}})},'test-job',async()=>{delivered=true;},async()=>({})),'sent');
assert.equal(delivered,false,'Already sent must not dispatch again');
let result;
await deliverParticipationMail({rpc:async(name,args)=>name.includes('claim')?{data:{outcome:'claimed',token:'t',payload,idempotencyKey:'k'}}:(result=args,{})},'test-job',async()=>{throw Error('timeout');},async()=>({}));
assert.equal(result.p_result,'unknown','Network error must not be treated as a known non-delivery');
console.log('PASS participation mail text and delivery outcomes (no provider/network)');
