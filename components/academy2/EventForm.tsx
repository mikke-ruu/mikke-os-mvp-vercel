'use client';

import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useAcademy2Headquarters} from './HeadquartersBoundary';
import {canAcademy2} from '@/lib/academy2/permissions.mjs';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import {createAcademy2Event, getAcademy2Event, updateAcademy2Event, type Academy2EventDetail, type Academy2EventInput, listAcademy2EventPlanChoices, type Academy2EventPlanChoice} from '@/lib/academy2/operations';
import {EventKitDestinationsForEvent} from './EventKitDestination';
import styles from './event-form.module.css';
import {useEventAssignee,EventAssigneeControl} from './EventAssigneeControl';

const cx=(...names:string[])=>names.map(name=>styles[name]).filter(Boolean).join(' ');
const localDate=(value:string|null)=>value ? new Date(Date.parse(value)+9*3600000).toISOString().slice(0,16) : '';

/** UI-07 event-create v0.2. Unsupported controls stay visible and unavailable; never silently discarded. */
export function Academy2EventForm({eventId,onBack,onSaved}:{eventId?:string;onBack?:()=>void;onSaved?:()=>void}) {
 const hq=useAcademy2Headquarters();
 const search=useSearchParams();
 const assignee=useEventAssignee(hq?.id,eventId);
 const [plans,setPlans]=useState<Academy2EventPlanChoice[]>([]);
 const [planId,setPlanId]=useState(search.get('plan')??'');
 const [courseId,setCourseId]=useState('');
 const [detail,setDetail]=useState<Academy2EventDetail|null>(null);
 const [form,setForm]=useState<Academy2EventInput>({title:'',scheduleMode:'fixed',startsAt:null,endsAt:null,format:'in_person',capacity:null,venueName:'',meetingUrl:''});
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[dirty,setDirty]=useState(false),[saved,setSaved]=useState(false),[retry,setRetry]=useState(0);
 const inFlight=useRef(false),request=useRef<{id:string;body:string}|null>(null);
 const allowed=!!hq&&canAcademy2(hq.role,'applications.operate',{sameHeadquarters:true});
 useEffect(()=>{if(!hq)return;let active=true;const preserveInput=dirty||assignee.dirty;setLoading(true);setError('');
  const run=async()=>{try{if(eventId){const row=await getAcademy2Event(hq.id,eventId);if(!active)return;
    // Do not turn an older read projection into empty strings and erase existing details.
    if(!Object.hasOwn(row,'venue_name')||!Object.hasOwn(row,'meeting_url'))throw new Error('開催詳細の保存接続を準備しています。会場・参加URLを保護するため編集を停止しています。');
    setDetail(row);setPlanId(row.sales_plan_id??'');setCourseId(row.course_id);
    if(!preserveInput)setForm({title:row.title,scheduleMode:row.schedule_mode,startsAt:row.starts_at,endsAt:row.ends_at,format:row.format,capacity:row.capacity,venueName:row.venue_name??'',meetingUrl:row.meeting_url??'',kitMethod:row.kit_method});
   }else{const rows=await listAcademy2EventPlanChoices(hq.id);if(active)setPlans(rows.filter(row=>row.configuration.study_style==='instructor'));}
   if(active){if(!preserveInput)setDirty(false);setSaved(false);}
  }catch(cause){if(active)setError(cause instanceof Error?cause.message:'開催を読み込めませんでした。');}finally{if(active)setLoading(false);}};void run();return()=>{active=false;};
 },[hq,eventId,retry]);
 useEffect(()=>{if(!dirty&&!assignee.dirty&&!saving)return;const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty,assignee.dirty,saving]);
 const leave=()=>!inFlight.current&&(!(dirty||assignee.dirty)||window.confirm('保存していない開催内容または担当者の入力があります。画面を移動しますか？'));
 if(!hq)return null;
 const href=(path:string)=>toAcademyContextHref(path,hq.id,'manage');
 const selected=plans.find(plan=>plan.id===planId);
 const config=selected?.configuration;
 const kit=detail?.kit_settings??config?.kit;
 const kitMethods=(kit?.methods??[]).filter(method=>form.format!=='online'||method==='shipping');
 const kitMethod=!kit?.enabled?null:kitMethods.length===1?kitMethods[0]:kitMethods.find(method=>method===form.kitMethod)??null;
 const kitLabel=kitMethod==='shipping'?'事前に発送':kitMethod==='venue_handover'?'会場で手渡し':kit?.enabled?'選択してください':'キットなし';
 const planTitle=detail?.sales_plan_name??config?.title??'販売プランを選択';
 const date=localDate(form.startsAt),end=localDate(form.endsAt);
 const change=<K extends keyof Academy2EventInput>(key:K,value:Academy2EventInput[K])=>{setForm(current=>({...current,[key]:value}));setDirty(true);setSaved(false);};
 const setDate=(day:string,time:string)=>change('startsAt',day&&time?new Date(`${day}T${time}:00+09:00`).toISOString():null);
 async function save(event:React.FormEvent){event.preventDefault();if(inFlight.current||!hq||!allowed)return;setError('');
  if(!form.title.trim())return setError('開催名を入力してください。');
  if(form.scheduleMode==='fixed'&&!form.startsAt)return setError('開催日・開始時間を入力してください。');
  if(form.endsAt&&(!form.startsAt||Date.parse(form.endsAt)<=Date.parse(form.startsAt)))return setError('終了時間は開始時間より後にしてください。');
  if(!eventId&&(!selected||!courseId))return setError('販売プランと講座を選択してください。');
  if(eventId&&(!detail||detail.revision===null))return setError('この開催は互換経路で保持されています。2.0からは変更できません。');
  if(!kit||!Array.isArray(kit.methods))return setError('キット設定を読み込めません。再読み込みしてください。');
  if(kit.enabled&&!kitMethod)return setError('キットの受け渡し方法を選択してください。');
  const input={...form,kitMethod};
  const body=JSON.stringify({eventId,revision:detail?.revision,planId,courseId,input});
  if(request.current?.body!==body)request.current={id:crypto.randomUUID(),body};
  inFlight.current=true;setSaving(true);
  try{const result=eventId?await updateAcademy2Event(hq.id,eventId,detail!.revision!,request.current!.id,input):await createAcademy2Event(hq.id,request.current!.id,{...input,planId,planRevision:selected!.revision,courseId});
   if(!eventId){window.location.assign(href(`/academy/classes/${result.id}`));return;}
   const persisted=await getAcademy2Event(hq.id,result.id);setDetail(persisted);setForm(current=>({...current,kitMethod:persisted.kit_method}));setDirty(false);request.current=null;await assignee.save();setSaved(true);onSaved?.();
  }catch(cause){setError(cause instanceof Error?cause.message:'保存できませんでした。入力内容は残っています。');}finally{inFlight.current=false;setSaving(false);}
 }
 const unsupported=<p className={styles.help}>この項目は保存接続を準備中です。今回の保存対象には含みません。</p>;
 return <main className={styles.wrap}>
  {onBack?<button className={styles.back} disabled={saving} onClick={()=>{if(leave())onBack();}}>← 開催詳細へ</button>:<Link className={styles.back} href={href('/academy/classes')} onClick={e=>{if(!leave())e.preventDefault();}}>← 開催一覧へ</Link>}
  <div className={styles.head}><div className={styles.en}>EVENT</div><div className={styles.jp}>{eventId?'開催の詳細・編集':'開催を追加'}</div></div>
  <div className={styles.intro}><strong>この販売プランの受付方法と、実際の開催内容を設定します。</strong><p>販売プランでは「対面・オンラインのどちらに対応できるか」まで設定済みです。ここでは今回の受付方法・日時・担当者・定員などを決めます。</p></div>
  {loading?<p role="status">読み込み中…</p>:<div className={styles.layout}><form className={styles.card} onSubmit={save}>
   <h2>どのように受け付けますか？</h2><div className={styles.help}>同じ販売プランに、日時指定の開催と日程相談の受付を両方追加できます。</div>
   <fieldset disabled={!allowed||saving||!!eventId&&!detail}>
    <div className={styles.planbox}><b>販売プラン</b>{eventId?<strong>{planTitle}</strong>:<div className={styles.field}><select aria-label="販売プラン" value={planId} onChange={e=>{setPlanId(e.target.value);setCourseId('');change('kitMethod',null);}}><option value="">選択してください</option>{plans.map(plan=><option key={plan.id} value={plan.id}>{plan.configuration.title}</option>)}</select></div>}
     <span>先生から受講</span>{!eventId&&selected?<div className={styles.field}><label>講座<select value={courseId} onChange={e=>{setCourseId(e.target.value);setDirty(true);}}><option value="">選択してください</option>{selected.course_snapshot.map(course=><option key={course.course_id} value={course.course_id}>{course.title}</option>)}</select></label></div>:null}
    </div>
    <div className={styles.field}><label>開催名<input value={form.title} onChange={e=>change('title',e.target.value)} maxLength={300}/></label></div>
    <div className={styles.choices}>{(['fixed','arranged_after_application'] as const).map(mode=><button type="button" aria-pressed={form.scheduleMode===mode} key={mode} className={cx('choice',form.scheduleMode===mode?'on':'')} onClick={()=>change('scheduleMode',mode)}><strong>{mode==='fixed'?'日時を決めて募集する':'申込後に日程を相談する'}</strong><p>{mode==='fixed'?'開催日・時間・会場などを決めて、その日程で参加者を募集します。':'まず申込を受け付け、申込者と相談して開催日時を決めます。'}</p></button>)}</div>
    <div className={styles.section}><h3>開催方法</h3><div className={styles.methods}>{(['in_person','online'] as const).map(method=><button type="button" key={method} disabled={!(detail?.allowed_methods??config?.allowed_methods??['in_person','online']).includes(method)} aria-pressed={form.format===method} className={cx('method',form.format===method?'on':'')} onClick={()=>change('format',method)}><strong>{method==='in_person'?'対面':'オンライン'}</strong><p>{method==='in_person'?'会場で開催します。':'Zoomなどで開催します。'}</p></button>)}</div></div>
    <div className={styles.section}><h3>{form.scheduleMode==='fixed'?'日時':'日程相談'}</h3>{form.scheduleMode!=='fixed'?<p className={styles.help}>受講日が決まっている場合は入力してください。未定のまま保存できます。</p>:null}<div className={styles.grid2}>
     <div className={styles.field}><label>開催日<input type="date" value={date.slice(0,10)} onChange={e=>setDate(e.target.value,date.slice(11)||'09:00')}/></label></div>
     <div className={styles.field}><label>開始時間<input type="time" value={date.slice(11)} onChange={e=>setDate(date.slice(0,10),e.target.value)}/></label></div>
     <div className={styles.field}><label>終了時間<input type="time" value={end.slice(11)} onChange={e=>change('endsAt',e.target.value&&date?new Date(`${date.slice(0,10)}T${e.target.value}:00+09:00`).toISOString():null)}/></label></div>
     <div className={styles.field}><label>定員<input type="number" min={1} value={form.capacity??''} onChange={e=>change('capacity',e.target.value?Number(e.target.value):null)}/></label></div>
    </div></div>
    <EventAssigneeControl state={assignee} locked={!allowed||saving||!!detail?.instructor_name}/>
    <div className={styles.section}><h3>{form.format==='in_person'?'会場':'オンライン参加'}</h3><div className={styles.field}>{form.format==='in_person'?<label>会場名<input value={form.venueName??''} onChange={e=>change('venueName',e.target.value)}/></label>:<label>参加URL<input type="url" placeholder="https://zoom.us/..." value={form.meetingUrl??''} onChange={e=>change('meetingUrl',e.target.value)}/></label>}</div>
     {form.format==='in_person'?<><div className={styles.field}><label>会場住所<input disabled/></label></div><div className={styles['visibility-options']}>{['詳しい住所まで公開','エリアだけ公開'].map(label=><button key={label} type="button" disabled className={styles.visibility}><strong>{label}</strong></button>)}</div><div className={styles.field}><label>販売ページに表示するエリア<input disabled/></label></div></>:null}
     <div className={styles.field}><label>参加者への案内<textarea disabled/></label></div>{unsupported}
    </div>
    <div className={styles.section}><h3>キットの受け渡し</h3><div className={styles.kit}><strong>{kit?.enabled?kit.name||'キットあり':'キットなし'}</strong>{kit?.enabled?<><p>{kitMethods.length>1?'販売プランで許可された方法から、この開催での受け渡し方法を選んでください。':form.format==='online'?'オンライン開催のキットは事前に発送します。':'販売プランで指定された方法で受け渡します。'}</p><div className={styles['kit-options']}>{kitMethods.map(method=><button key={method} type="button" aria-pressed={kitMethod===method} className={cx('kit-pill',kitMethod===method?'on':'')} onClick={()=>change('kitMethod',method)}>{method==='shipping'?'事前に発送':'会場で手渡し'}</button>)}</div>{!kitMethods.length?<p role="alert">この開催方法で利用できるキットの受け渡し方法がありません。販売プランを確認してください。</p>:null}{kit.recipient==='instructor'?<p>キットの発送先は担当講師です。受講者への受け渡し方法を確認してください。</p>:null}{eventId&&form.format==='in_person'&&kit.recipient==='instructor'?<EventKitDestinationsForEvent headquartersId={hq.id} eventId={eventId}/>:null}</>:null}</div></div>
    <div className={styles.section}><h3>受付状態</h3><div className={styles.field}><select disabled value={detail?.registration_status??'closed'}><option value="draft">下書き</option><option value="closed">受付停止中</option><option value="open">受付中</option></select></div><p className={styles.help}>開催の保存だけでは募集は公開されません。公開条件を確認した販売ページとの接続が必要です。</p></div>
    <div className={styles.actions}>{onBack?<button type="button" className={styles.btn} disabled={saving} onClick={()=>{if(leave())onBack();}}>← 開催詳細へ</button>:<Link className={styles.btn} href={href('/academy/classes')} onClick={e=>{if(!leave())e.preventDefault();}}>← 戻る</Link>}<button className={cx('btn','primary')} type="submit" disabled={saving}>{saving?'保存中…':'開催を保存'}</button></div>
   </fieldset>
   {error?<div role="alert" className={styles.error}>{error}<button type="button" className={styles.btn} onClick={()=>setRetry(value=>value+1)}>再読み込み</button></div>:null}
   <p role="status" className={styles.help}>{saving?'保存中':dirty||assignee.dirty?'未保存の変更があります':saved?'保存しました':detail?'保存済みの内容です':''}</p>
  </form><aside className={cx('card','summary')}><h3>この開催の内容</h3>{[['販売プラン',planTitle],['受付方法',form.scheduleMode==='fixed'?'日時を決めて募集':'申込後に日程相談'],['開催方法',form.format==='in_person'?'対面':'オンライン'],['日時',date||'申込後に相談'],['担当',assignee.view?.assignment?.name??detail?.instructor_name??'未設定'],['キットの受け渡し',kitLabel],['定員',form.capacity===null?'未設定':`${form.capacity}名`]].map(([label,value])=><div className={styles.sumrow} key={label}><span>{label}</span><span>{value}</span></div>)}
   <div className={styles.status}>会場公開範囲・認定講師依頼等、接続準備中の項目は変更できません。</div>
   {detail?<Link className={styles.btn} href={href('/academy/offering-applications')}>申込を確認</Link>:null}
  </aside></div>}
 </main>;
}
