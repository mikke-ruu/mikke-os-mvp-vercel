const assert=require('node:assert/strict');
const base='http://127.0.0.1:4192';
async function api(body){const r=await fetch(base+'/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();return {status:r.status,data};}
(async()=>{
 for(const route of ['/staff','/self','/style.css','/bundle.js'])assert.equal((await fetch(base+route)).status,200);
 const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit'}).format(new Date());
 const read=role=>api({op:'read',role,args:{month_start:month+'-01'}});
 const initial=(await read('staff')).data;assert.ok(initial.lessons.length>0);
 const actual=initial.lessons.find(r=>r.calculationBasis==='actual'&&r.status==='completed');
 const rate=initial.rates[0];
 const clocks={actual_start_time:actual.actualStartTime??null,actual_end_time:actual.actualEndTime??null,actual_end_next_day:actual.actualEndNextDay??false,actual_break_minutes:actual.actualBreakMinutes??0};
 const setClock=value=>api({op:'update',role:'staff',table:'team_works_partner_lesson_history',filters:{id:actual.id},value});
 const saveRate=(hourlyWage,calculationBasis)=>api({op:'rate',role:'staff',input:{...rate,organizationMemberId:rate.memberId,hourlyWage,calculationBasis}});
 try{
  assert.equal((await saveRate(1500,'scheduled')).status,200);
  const updated=(await read('self')).data;assert.equal(updated.rates[0].hourlyWage,1500);assert.equal(updated.rates[0].calculationBasis,'scheduled');
  assert.equal(updated.lessons.find(r=>r.id===actual.id).hourlyWage,actual.hourlyWage);
  assert.equal((await api({op:'update',role:'self',table:'team_works_partner_lesson_history',filters:{id:actual.id},value:{actual_minutes:50}})).status,400);
  assert.equal((await setClock({actual_start_time:'14:00',actual_end_time:'15:00',actual_end_next_day:false,actual_break_minutes:10})).status,200);
  const after=(await read('self')).data.lessons.find(r=>r.id===actual.id);assert.equal(after.amount,actual.hourlyWage===null?null:Math.round(actual.hourlyWage*50/60));assert.equal(after.actualMinutes,50);
  assert.equal((await setClock({actual_start_time:'14:00',actual_end_time:'13:00',actual_end_next_day:false,actual_break_minutes:0})).status,400);
 }finally{
  await saveRate(rate.hourlyWage,rate.calculationBasis);
  await setClock(clocks);
  await api({op:'update',role:'staff',table:'team_works_partner_lesson_history',filters:{id:actual.id},value:{actual_minutes:actual.actualMinutes}});
 }
 console.log('PASS local HTTP assets, rate/basis save and reload, frozen historical rate, actual-minute recalculation, self update rejection, invalid minutes rejection; fixture restored');
})().catch(e=>{console.error(e);process.exitCode=1});
