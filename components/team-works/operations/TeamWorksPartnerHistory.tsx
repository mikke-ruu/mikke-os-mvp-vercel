"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase/client';
import {historyTotals,loadPartnerHistory,parseHourlyWage,parseActualMinutes,type PartnerHistory} from '@/lib/team-works-partner-history';
import {updateOperationsProjectPartnerSetting} from '@/lib/team-works-operations-project';
const inputClass='rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2 text-[var(--mikke-text)]';
const yen=(value:number)=>`${value.toLocaleString('ja-JP')}円`;
export function TeamWorksPartnerHistory({partnerId=null}:{partnerId?:string|null}){
 const [month,setMonth]=useState(()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit'}).format(new Date()));
 const [data,setData]=useState<PartnerHistory|null>(null);
 const [error,setError]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);
 const sequence=useRef(0);
 const load=useCallback(async()=>{const turn=++sequence.current;setLoading(true);setError('');try{const result=await loadPartnerHistory(supabase,month,partnerId);if(turn===sequence.current)setData(result);}catch(e){if(turn===sequence.current){setData(null);setError(e instanceof Error?e.message:'読み込めませんでした。');}}finally{if(turn===sequence.current)setLoading(false);}},[month,partnerId]);
 useEffect(()=>{void load();return()=>{sequence.current++;};},[load]);
 async function save(action:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await action();setNotice('保存しました。');await load();}catch(e){setError(e instanceof Error?e.message:'保存できませんでした。');}finally{setBusy(false);}}
 return <TeamWorksPartnerHistoryContent data={data} partnerId={partnerId} month={month} loading={loading} error={error} notice={notice} busy={busy} setMonth={setMonth} save={save}/>;
}
export function TeamWorksPartnerHistoryContent({data,partnerId,month,loading,error,notice,busy,setMonth,save}:{data:PartnerHistory|null;partnerId:string|null;month:string;loading:boolean;error:string;notice:string;busy:boolean;setMonth:(value:string)=>void;save:(action:()=>Promise<void>)=>Promise<void>}){
 const totals=historyTotals(data?.lessons??[]);
 return <div className="space-y-5">
  {data?.partnerName?<h2 className="text-lg font-bold">{data.partnerName}さんの実施履歴・報酬</h2>:null}
  <p className="text-sm leading-6 text-[var(--mikke-muted)]">本部が設定した計算方法と時間で、完了分の報酬を計算します。1回ごとに1円単位で四捨五入します。支払済みの金額を示す画面ではありません。</p>
  <label className="flex items-center gap-3 text-sm font-bold">対象月<input aria-label="対象月" type="month" value={month} disabled={busy} onChange={e=>setMonth(e.target.value)} className={inputClass}/></label>
  {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
  {loading?<p role="status">読み込み中…</p>:data?<>
   <section className="rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4">
    <h3 className="font-bold">完了分の集計</h3><p className="mt-2">{totals.count}回 ／ 時間確認済み分 {totals.minutes}分 ／ 計算済み分 {yen(totals.amount)}</p>
    {totals.unpriced>0?<p className="mt-2 text-sm">時給または実稼働時間が未設定の記録が{totals.unpriced}件あります。その分の金額は合計に含めていません。</p>:null}
   </section>
   <section className="space-y-3"><h3 className="font-bold">プロジェクトごとの時給・計算方法</h3>
    <p className="text-xs text-[var(--mikke-muted)]">変更はこれから完了する担当分に適用します。記録済みの金額は変わりません。</p>
    {!data.rates.length?<p className="text-sm">担当プロジェクトの登録はまだありません。</p>:data.rates.map(rate=><article key={`${rate.projectId}:${rate.memberId}`} className="rounded-xl border border-[var(--mikke-line)] p-4"><h4 className="font-bold">{rate.projectTitle}{rate.status==='removed'?'（担当終了）':''}</h4>
     <p className="mt-2 text-sm font-bold">計算方法：{rate.calculationBasis==='actual'?'実稼働時間（本部確認）':'予定表の時間（固定）'}</p>
     {partnerId?<RateEditor key={`${rate.projectId}:${rate.memberId}:${rate.hourlyWage}:${rate.calculationBasis}`} value={rate.hourlyWage} basis={rate.calculationBasis} disabled={busy} label={`${rate.projectTitle}の時給`} onSave={(value,basis)=>save(()=>updateOperationsProjectPartnerSetting(supabase,{projectId:rate.projectId,organizationMemberId:rate.memberId,hourlyWage:value,calculationBasis:basis,status:rate.status}))}/>:<p className="mt-2 text-sm">{rate.hourlyWage===null?'未設定':`${yen(rate.hourlyWage)} / 時間`}</p>}
    </article>)}
   </section>
   <section className="space-y-3"><h3 className="font-bold">実施履歴</h3>
    <p className="text-xs leading-5 text-[var(--mikke-muted)]">過去分の時給は推測せず、未設定で残しています。研修分は本部が各回の時給を確認して登録します。中止・実施未確認は合計に含めません。</p>
    {!data.lessons.length?<p className="rounded-xl border border-[var(--mikke-line)] p-4">この月の履歴はありません。</p>:data.lessons.map(row=><article key={`${row.sessionId}:${row.memberId}`} className="rounded-xl border border-[var(--mikke-line)] p-4">
     <p className="font-bold">{row.date} {row.startTime.slice(0,5)} ／ {row.projectTitle}</p>
     <p className="mt-2 text-sm">{row.role==='training'?'研修':'担当'} ／ {row.minutes}分 ／ {row.status==='completed'?'完了':row.status==='cancelled'?'中止':'実施未確認'}</p>
     <p className="mt-2 text-sm font-bold">計算方法：{row.calculationBasis==='actual'?'実稼働時間（本部確認）':'予定表の時間（固定）'}</p>
     <p className="mt-1 text-sm">計算に使う時間：{row.calculationBasis==='actual'?(row.actualMinutes===null?'未確認':`${row.actualMinutes}分`):`${row.minutes}分`}</p>
     <p className="mt-2 text-sm">時給：{row.hourlyWage===null?'未設定':yen(row.hourlyWage)}　金額：{row.status!=='completed'?'集計対象外':row.amount===null?'未設定':yen(row.amount)}</p>
     {partnerId&&row.status==='unconfirmed'?<button type="button" disabled={busy} className="mt-3 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" onClick={()=>void save(async()=>{const {error}=await supabase.from('team_works_op_sessions').update({status:'completed'}).eq('id',row.sessionId).eq('status','scheduled').select('id').single();if(error)throw new Error('実施状況を記録できませんでした。再読み込みしてご確認ください。');})}>この回を実施済みとして記録</button>:null}
     {partnerId&&row.id&&row.status==='completed'&&row.calculationBasis==='actual'?<ActualTimeEditor key={`${row.id}:${row.actualMinutes}`} value={row.actualMinutes} disabled={busy} onSave={minutes=>save(async()=>{const {error}=await supabase.from('team_works_partner_lesson_history').update({actual_minutes:minutes}).eq('id',row.id).select('id').single();if(error)throw new Error('実稼働時間を保存できませんでした。');})}/>:null}
     {partnerId&&row.id&&row.status==='completed'&&row.hourlyWage===null?<RateEditor value={null} disabled={busy} label={`${row.date}の記録に適用する時給`} required onSave={value=>save(async()=>{if(value===null)throw new Error('時給を入力してください。');const {error}=await supabase.from('team_works_partner_lesson_history').update({hourly_wage:value}).eq('id',row.id).is('hourly_wage',null).select('id').single();if(error)throw new Error('保存できませんでした。再読み込みして記録と権限をご確認ください。');})}/>:null}
    </article>)}
   </section>
  </>:null}
 </div>;
}
function RateEditor({value,basis,disabled,label,onSave,required=false}:{value:number|null;basis?:'scheduled'|'actual';disabled:boolean;label:string;onSave:(value:number|null,basis?:'scheduled'|'actual')=>Promise<void>;required?:boolean}){
 const [selectedBasis,setSelectedBasis]=useState<'scheduled'|'actual'>(basis??'scheduled');
 const [text,setText]=useState(value===null?'':String(value));const [error,setError]=useState('');
 return <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={event=>{event.preventDefault();setError('');try{const rate=parseHourlyWage(text);if(required&&rate===null)throw new Error('時給を入力してください。');void onSave(rate,basis===undefined?undefined:selectedBasis);}catch(e){setError(e instanceof Error?e.message:'入力をご確認ください。');}}}>
  <label className="text-xs"><span className="mb-1 block">{label}</span><input aria-label={label} type="number" min="0" step="1" value={text} onChange={e=>setText(e.target.value)} disabled={disabled} className={`${inputClass} w-36`} placeholder="未設定"/> 円 / 時間</label>
  {basis!==undefined?<label className="text-xs"><span className="mb-1 block">計算方法</span><select aria-label="計算方法" disabled={disabled} value={selectedBasis} onChange={e=>setSelectedBasis(e.target.value as 'scheduled'|'actual')} className={inputClass}><option value="scheduled">予定表の時間（固定）</option><option value="actual">実稼働時間（本部確認）</option></select></label>:null}
  <button disabled={disabled} type="submit" className="rounded-lg bg-[var(--tw-action)] px-4 py-2 text-sm font-bold text-[var(--tw-on-solid)] disabled:opacity-50">保存</button>{error?<p role="alert">{error}</p>:null}
 </form>;
}

function ActualTimeEditor({value,disabled,onSave}:{value:number|null;disabled:boolean;onSave:(minutes:number)=>Promise<void>}){
 const [text,setText]=useState(value===null?'':String(value));const [error,setError]=useState('');
 return <form className="mt-3 space-y-2" onSubmit={e=>{e.preventDefault();setError('');try{void onSave(parseActualMinutes(text));}catch(error){setError(error instanceof Error?error.message:'入力をご確認ください。');}}}>
 <p className="text-xs text-[var(--mikke-muted)]">ログイン時間ではなく、待機・休憩を除いた実稼働時間を確認して登録してください。保存するとこの回の金額が更新されます。</p>
 <div className="flex flex-wrap items-center gap-2"><label>実稼働 <input aria-label="本部が確認した実稼働時間（分）" type="number" min="0" max="1440" step="1" value={text} disabled={disabled} onChange={e=>setText(e.target.value)} className={inputClass+' w-24'}/> 分</label><button type="submit" disabled={disabled} className="rounded-lg bg-[var(--tw-action)] px-3 py-2 font-bold text-[var(--tw-on-solid)] disabled:opacity-50">確認して保存</button></div>{error?<p role="alert">{error}</p>:null}
 </form>;
}
