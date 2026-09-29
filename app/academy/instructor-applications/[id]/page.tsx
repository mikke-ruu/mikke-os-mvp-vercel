"use client";
import {useEffect,useRef,useState} from 'react';
import {useParams,useRouter} from 'next/navigation';
import {useAuth} from '@/components/AuthGate';
import {InstructorOperationsShell} from '@/components/academy2/InstructorOperationsShell';
import {InstructorApplicationDetail,type InstructorScheduleInput} from '@/components/academy2/InstructorApplicationDetail';
import {getMyInstructorApplication,commandInstructorApplication,type InstructorApplicationDetailData} from '@/lib/academy2/instructor-operations';
import {supabase} from '@/lib/supabase/client';
function scheduleInputFromSaved(data:InstructorApplicationDetailData):InstructorScheduleInput {
 if(data.details.scheduleInput)return data.details.scheduleInput;
 const parts=(value:string|null)=>{if(!value||!Number.isFinite(Date.parse(value)))return null;return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(part=>[part.type,part.value]));};
 const start=parts(data.view.schedule.startsAt),end=parts(data.view.schedule.endsAt);
 return {date:start?`${start.year}-${start.month}-${start.day}`:'',startsAt:start?`${start.hour}:${start.minute}`:'',endsAt:end?`${end.hour}:${end.minute}`:'',onlineUrl:''};
}
function Detail({id}:{id:string}){
 const {user}=useAuth();const router=useRouter();const [data,setData]=useState<InstructorApplicationDetailData|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null);const [retry,setRetry]=useState(0);
 const commands=useRef(new Map<string,string>());const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{let current=true;setLoading(true);setError(null);setData(null);if(!user)return;if(!/^[0-9a-f-]{36}$/i.test(id)){setError('申込が見つかりません。');setLoading(false);return;}
 void getMyInstructorApplication(id).then(value=>{if(current)setData(value);}).catch(e=>{if(current)setError(e instanceof Error?e.message:'申込を読み込めませんでした。');}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;};},[id,user,retry]);
 async function command(type:'confirm_tuition'|'confirm_schedule'|'record_attendance'|'submit_completion'|'set_kit_destination',payload?:Record<string,string>){if(!data)throw Error('申込を再読み込みしてください。');const key=JSON.stringify([data.revision,type,payload]);const requestId=commands.current.get(key)??crypto.randomUUID();commands.current.set(key,requestId);const value=await commandInstructorApplication(id,data.revision,requestId,{type,payload});if(mounted.current)setData(value);commands.current.delete(key);}
 async function schedule(input:InstructorScheduleInput){const startsAt=new Date(`${input.date}T${input.startsAt}:00+09:00`);const endsAt=new Date(`${input.date}T${input.endsAt}:00+09:00`);if(!Number.isFinite(+startsAt)||!Number.isFinite(+endsAt)||endsAt<=startsAt)throw Error('開始・終了時間を確認してください。');await command('confirm_schedule',{startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString(),onlineUrl:input.onlineUrl});}
 async function checkout(){const {data:sessionData,error:sessionError}=await supabase.auth.getSession();if(sessionError||!sessionData.session)throw Error('ログイン状態を確認してください。');const key=`checkout:${id}`;const requestId=commands.current.get(key)??crypto.randomUUID();commands.current.set(key,requestId);const response=await fetch('/academy/api/opening-license/checkout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${sessionData.session.access_token}`},body:JSON.stringify({applicationId:id,requestId})});const body=await response.json();if(!response.ok)throw Error(typeof body.message==='string'?body.message:'お支払いページを開けませんでした。');if(typeof body.checkoutUrl!=='string')throw Error('お支払い先を確認できませんでした。');const url=new URL(body.checkoutUrl,window.location.origin);const local=url.origin===window.location.origin&&url.pathname.startsWith('/academy/opening-license-checkout/');const stripeTest=body.provider==='stripe_test_direct'&&url.protocol==='https:'&&url.hostname==='checkout.stripe.com'&&!url.port&&!url.username&&!url.password;if(!local&&!stripeTest)throw Error('お支払い先を確認できませんでした。');window.location.assign(url.href);}
 if(loading)return <p role="status" className="p-6 text-sm">申込を読み込んでいます…</p>;if(error||!data)return <div className="p-6 text-sm"><p role="alert">{error??'申込が見つかりません。'}</p><button type="button" onClick={()=>setRetry(n=>n+1)}>もう一度読み込む</button></div>;
 const allowed=(action:string)=>data.allowedActions.includes(action);
 return <InstructorApplicationDetail operationsConnected view={data.view} details={{...data.details,scheduleInput:scheduleInputFromSaved(data)}} onReload={async()=>{const value=await getMyInstructorApplication(id);if(mounted.current)setData(value);}} onBack={()=>router.push('/academy/instructor-applications')} actions={{confirmKitDestination:allowed('set_kit_destination')?(addressId)=>command('set_kit_destination',{addressId}):undefined,confirmTuition:allowed('confirm_tuition')?()=>command('confirm_tuition'):undefined,confirmSchedule:allowed('confirm_schedule')?schedule:undefined,recordAttendance:allowed('record_attendance')?()=>command('record_attendance'):undefined,openCompletionReport:allowed('submit_completion')?()=>command('submit_completion',{report:''}):undefined,payOpeningLicense:allowed('pay_opening_license')?checkout:undefined}}/>;
}
function Identity(){const {user}=useAuth();const {id}=useParams<{id:string}>();return <Detail key={`${user?.id}:${id}`} id={id}/>;}
export default function Page(){return <InstructorOperationsShell><Identity/></InstructorOperationsShell>;}






