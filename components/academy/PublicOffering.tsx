"use client";

import Link from "next/link";
import {MonthlyPolicySummary} from '@/components/academy2/MonthlyPolicySummary';
import {monthlyPolicyMessages} from '@/lib/academy2/monthly-policy-display.mjs';
import { applicationAnswerLimit, publicIntakeHistoryHref, type PublicApplicationForm } from "@/lib/academy2/public-intake";
import {applicationContext,intakeFields,projectApplicationAnswers} from "@/lib/academy2/application-conditions.mjs";
import type {SalesPlan} from "@/lib/academy2/sales-plan.mjs";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase/client";
import { academyPublicClient } from "@/lib/academy/public-client";
import type { AcademyOffering } from "@/lib/academy/offerings";
import { toAcademyContextHref } from "@/lib/academy/access-context";
import { AcademyCourseCard, type AcademyCourseCardInfo } from "./AcademyCourseCard";
import { AcademyLpRenderer } from "./AcademyLpRenderer";
import { LpContent } from "@/components/mikkeos/page-builder/LpDesign";
import type { LpBlock } from "@/components/mikkeos/page-builder/lp-design";
import { offeringPurchaseState, type OfferingPurchaseHistory } from "@/lib/academy/offering-purchase";
import {isPublicPaymentMethod,cardCheckoutHref,publicIntakeSubmission,publicPaymentLabels,safeExternalPaymentUrl} from '@/lib/academy2/public-intake-payments';

import {readPublicStageQuote,stagePurchaseState,viewerIntakeScope,scopedViewerData,type PublicStageQuote} from '@/lib/academy2/public-stage-quote';

type PublicData = Pick<AcademyOffering, "id" | "headquarters_id" | "title" | "kind" | "price" | "currency" | "lp_blocks" | "purchase_mode" | "stage_prices" | "course_ids"> & { payment_methods:string[];external_payment_url?:string|null;courses: (AcademyCourseCardInfo & { id: string })[] };
type Receipt = { id: string; price: number; status: string; headquarters_id: string; offering_title: string;payment_method?:string;external_payment_url?:string|null };
type InstructorPage = { id: string; profile: { display_name?: string; bio?: string; image_url?: string; contact_email?: string; application_note?: string }; lp_blocks: LpBlock[] };
type Intake = { stage?:PublicStageQuote|null; applicationForm?: PublicApplicationForm & {readinessReasons?:string[]}; formConfiguration?: Partial<SalesPlan>; mode: 'headquarters' | 'instructor'; offering: PublicData; page: InstructorPage | null; terms: {version: string; body: string}; eventRequired: boolean; events: {id: string; courseId?:string; title: string; startsAt: string | null; scheduleMode: string; format: string; kitMethod?:string|null; formReady?:boolean}[] };
const inputClass = "mt-1 block min-h-12 w-full rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2";

export function PublicOffering({ id, instructor = false }: { id: string; instructor?: boolean }) {
  const [publicOffering, setOffering] = useState<PublicData | null>(null);
  const [instructorPage, setInstructorPage] = useState<InstructorPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState("bank");
  const [busy, setBusy] = useState(false);
  const [receiptData, setReceipt] = useState<Receipt | null>(null);
  const [checkoutData,setCheckoutHref]=useState<string|null>(null);
  const [history, setHistory] = useState<OfferingPurchaseHistory[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [publicIntake, setIntake] = useState<Intake | null>(null);
  const [cardMode,setCardMode]=useState<'test'|'live'|undefined>(undefined);
  const [viewerIntake,setViewerIntake]=useState<{scope:string;data:Intake}|null>(null);
  const [viewerError,setViewerError]=useState<{scope:string;message:string}|null>(null);
  const viewerScope=viewerIntakeScope(id,instructor,userId);
  const activeViewer=useRef(viewerScope);activeViewer.current=viewerScope;
  const [receiptScope,setReceiptScope]=useState<string|null>(null);
  const receipt=receiptScope===viewerScope?receiptData:null;
  const checkoutHref=receiptScope===viewerScope?checkoutData:null;
  const stagedV2=!!publicIntake && publicOffering?.purchase_mode==='staged';
  const ownIntake=scopedViewerData(viewerScope,viewerIntake);
  const intake=stagedV2?(ownIntake??publicIntake):publicIntake;
  const offering=stagedV2&&ownIntake?ownIntake.offering:publicOffering;
  const stageQuote=stagedV2&&ownIntake?readPublicStageQuote(ownIntake.stage):null;
  const stageReady=!stagedV2||!!stageQuote;
  const [classId, setClassId] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const pending = useRef(false);
  const requestToken = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setReceipt(null);setCheckoutHref(null); setOffering(null); setInstructorPage(null); setIntake(null); setClassId(''); setAgreed(false); setAnswers({}); requestToken.current = null;
    void (async () => {
      let stripeQuote:Record<string,unknown>|null=null;
      if(active)setCardMode(undefined);
      if(!instructor){
        const response=await fetch('/api/academy2/course-stripe-candidate/quote',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({offeringId:id}),signal:AbortSignal.timeout(30000)});
        const value=await response.json();
        if(!response.ok||typeof value.enabled!=='boolean')throw new Error('INTAKE_UNAVAILABLE');
        if(value.enabled){
          if(value.card_ready!==true||value.card_provider!=='stripe_connect'||!['test','live'].includes(value.card_mode))throw new Error('INTAKE_UNAVAILABLE');
          stripeQuote=value;if(active)setCardMode(value.card_mode);
        }else if(active)setCardMode(undefined);
      }else if(active)setCardMode(undefined);
      const check = stripeQuote?{data:stripeQuote as unknown as Intake,error:null}:await academyPublicClient.rpc('academy2_public_intake_with_form', {p_id: id, p_instructor: instructor}).abortSignal(AbortSignal.timeout(30000));
      // Missing migration is the only legacy fallback. Transport/permission failures
      // must not route an opted-in plan through an older write path.
      if (check.error && check.error.code !== 'PGRST202') throw check.error;
      if (check.error?.code === 'PGRST202') {
        const previous = await academyPublicClient.rpc('academy2_public_intake', {p_id: id, p_instructor: instructor}).abortSignal(AbortSignal.timeout(30000));
        if (previous.data || (previous.error && previous.error.code !== 'PGRST202')) throw new Error('INTAKE_UNAVAILABLE');
      }
      if (check.data) {
        if (check.data.mode === 'unavailable') throw new Error('INTAKE_UNAVAILABLE');
        if (active) setIntake(check.data as Intake);
        return {data: instructor ? {offering: check.data.offering, page: check.data.page} : check.data.offering, error: null};
      }
      return await academyPublicClient.rpc(instructor ? "academy_get_public_instructor_offering" : "academy_get_public_offering", instructor ? { p_page_id: id } : { p_offering_id: id }).abortSignal(AbortSignal.timeout(30000));
    })().then(({ data, error: readError }) => {
      if (!active) return;
      if (readError) setError("サービスを読み込めませんでした。時間をおいて再読み込みしてください。");
      else if (!data) setError("このサービスは現在公開されていません。");
      else {
        const details = (instructor ? data.offering : data) as PublicData;
        setOffering(details); setMethod(details.payment_methods[0] ?? "bank");
        if (instructor) setInstructorPage(data.page as InstructorPage);
      }
    }).catch((cause) => {
      if (active) setError(cause instanceof Error && cause.message === 'INTAKE_UNAVAILABLE' ? 'この販売プランは現在お申し込みを受け付けていません。' : "サービスを読み込めませんでした。時間をおいて再読み込みしてください。");
    }).finally(() => { if (active) setLoading(false); });
    let authChanged=false;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active || authChanged) return;
      setUserId(data.user?.id ?? null); setEmail(data.user?.email ?? ""); setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) { authChanged=true;setUserId(session?.user.id ?? null);setEmail(session?.user.email??"");setAuthReady(true); }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [id, instructor, retry]);

  useEffect(() => {
    let active=true;
    setViewerIntake(null);setViewerError(null);setReceipt(null);setCheckoutHref(null);
    setAnswers({});setName('');setClassId('');setAgreed(false);requestToken.current=null;
    if(!stagedV2||!userId)return ()=>{active=false;};
    void Promise.resolve(supabase.rpc('academy2_public_intake_with_form',{p_id:id,p_instructor:instructor}).abortSignal(AbortSignal.timeout(30000))).then(({data,error:readError})=>{
      if(!active)return;
      if(readError||!data||data.mode==='unavailable'||!readPublicStageQuote(data.stage)){
        setViewerError({scope:viewerScope,message:'今回お申し込みできる講座を確認できませんでした。再読み込みしてください。'});return;
      }
      setViewerIntake({scope:viewerScope,data:data as Intake});
    }).catch(()=>{if(active)setViewerError({scope:viewerScope,message:'今回お申し込みできる講座を確認できませんでした。再読み込みしてください。'});});
    return ()=>{active=false;};
  },[stagedV2,userId,id,instructor,viewerScope,retry]);

  useEffect(() => {
    let active = true;
    setHistoryReady(false); setHistory([]);
    if (stagedV2 || !userId || !offering) return () => { active = false; };
    void supabase.from("academy_offering_applications").select("id,offering_id,headquarters_id,offering_title,status,price,stage_index,completed_at,purchase_snapshot").eq("offering_id", offering.id).eq("learner_user_id", userId).abortSignal(AbortSignal.timeout(30000)).then(({ data, error: historyError }) => {
      if (!active) return;
      if (historyError) setError("申込履歴を確認できませんでした。再読み込みしてください。");
      else { setHistory((data ?? []) as OfferingPurchaseHistory[]); setHistoryReady(true); }
    });
    return () => { active = false; };
  }, [offering, userId, stagedV2]);
  const purchase = stagedV2 ? stagePurchaseState(stageQuote) : offering ? offeringPurchaseState(offering, history) : null;
  const purchaseReady=stagedV2?stageReady:historyReady;
  const paymentMethods = (stagedV2 ? stageQuote?.payment_methods??[] : purchase?.current?.purchase_snapshot?.payment_methods ?? offering?.payment_methods ?? []).filter(isPublicPaymentMethod);
  useEffect(() => { if (paymentMethods.length && (!isPublicPaymentMethod(method)||!paymentMethods.includes(method))) setMethod(paymentMethods[0]); }, [paymentMethods, method]);
  const externalUrl=safeExternalPaymentUrl(stagedV2?stageQuote?.external_payment_url:offering?.external_payment_url);
  const receiptExternalUrl=safeExternalPaymentUrl(receipt?.external_payment_url);

  const stageEvents=stagedV2?stageQuote?intake?.events.filter(event=>event.courseId===stageQuote.course_id)??[]:[]:intake?.events??[];
  const selectedEvent=stageEvents.find(event=>event.id===classId)??null;
  const formContext=applicationContext(stagedV2?{...intake?.formConfiguration,course_ids:stageQuote?[stageQuote.course_id]:[]}:intake?.formConfiguration??{},selectedEvent,intake?.mode);
  const displayedFields=intakeFields(intake?.applicationForm,formContext,answers);
  const monthlyBlocked=offering?.kind==='月額レッスン'&&monthlyPolicyMessages(intake?.formConfiguration?.monthly).length>0;
  const formBlocked=intake?.applicationForm?.conditionalVersion===1 && (!!intake.applicationForm.readinessReasons?.length || selectedEvent?.formReady===false);
  async function apply(event: FormEvent) {
    event.preventDefault();
    if (pending.current || !offering || !userId || !purchaseReady || !purchase || purchase.blocked || !Number.isFinite(purchase.amount)) return;
    if (formBlocked||monthlyBlocked) return;
    if(!isPublicPaymentMethod(method)||!paymentMethods.includes(method)||checkoutHref)return;
    if(intake?.mode==='headquarters'&&method==='external'&&!externalUrl){setError('外部の決済ページを確認できません。本部へお問い合わせください。');return;}
    if (intake && (!agreed || (intake.eventRequired && (!classId || !selectedEvent)))) return;
    pending.current = true; setBusy(true); setError("");
    requestToken.current ??= crypto.randomUUID();
    try {
      const submission=intake?publicIntakeSubmission(instructor,method,{
        p_id: id, p_request: requestToken.current, p_name: name.trim(),
        p_answers: projectApplicationAnswers(displayedFields,answers), p_terms: intake.terms.version, p_agree: agreed, p_price: purchase.amount, p_class: classId || null,
      },cardMode):null;
      const { data, error: submitError } = submission ? await supabase.rpc(submission.name,submission.args).abortSignal(AbortSignal.timeout(30000)) : await supabase.rpc(instructor ? "academy_submit_instructor_offering_application" : "academy_submit_offering_application", {
        ...(instructor ? { p_page_id: id } : { p_offering_id: id }), p_request_token: requestToken.current,
        p_applicant_name: name.trim(), p_applicant_email: email.trim(), p_payment_method: method,
        p_expected_price: purchase.amount,
      }).abortSignal(AbortSignal.timeout(30000));
      if(activeViewer.current!==viewerScope)return;
      if (submitError) throw submitError;
      if (!data?.id) throw new Error("受付結果を確認できませんでした。");
      if(intake?.mode==='headquarters'&&method==='card'){
        const target=cardCheckoutHref(data);
        if(!target)throw new Error('UNVERIFIED_CHECKOUT_PROVIDER');
        setReceiptScope(viewerScope);setCheckoutHref(target);window.location.assign(target);return;
      }
      if(intake?.mode==='headquarters'&&data.payment_method!==method)throw new Error('PAYMENT_METHOD_MISMATCH');
      setReceiptScope(viewerScope);setReceipt(data as Receipt);
    } catch (submitError) {
      if(activeViewer.current!==viewerScope)return;
      const message = typeof submitError === "object" && submitError !== null && "message" in submitError ? String(submitError.message) : "";
      setError(message==='UNVERIFIED_CHECKOUT_PROVIDER'?'カード決済の受付先を確認できないため、画面を移動しませんでした。申込一覧で受付状況を確認してください。':/abort|timeout/i.test(message)?'通信が完了しませんでした。入力内容は残っています。申込一覧を確認してから、同じ内容でもう一度お試しください。':message.includes('application_answer_required') ? '必須項目を入力してください。' : message.includes('application_answer_retry_changed') ? '送信済みの回答と内容が異なります。申込一覧から受付内容を確認してください。' : message.includes('application_answer_') || message.includes('application_answers_') ? '追加項目の入力内容を確認してください。' : message.includes("offering_price_changed") || message.includes('publication_or_terms_changed') ? "価格または規約が更新されています。再読み込みして確認してからお申し込みください。" : message.includes('event_full') ? 'この開催は定員に達しました。別の開催を選んでください。' : "申込の受付を確認できませんでした。申込一覧を確認し、受付がない場合はもう一度お試しください。");
    } finally { pending.current = false; setBusy(false); }
  }

  function render(blocks: LpBlock[]) {
    return blocks.map(block => {
      if (block.lp?.reference) {
        const course = offering?.courses.find(item => item.id === block.lp!.reference!.id);
        return course ? <AcademyCourseCard key={block.id} course={course} imageSide={block.lp.reference.imageSide} hidePrice /> : null;
      }
      return <AcademyLpRenderer key={block.id} blocks={[block]} />;
    });
  }

  if (loading) return <main className="mx-auto max-w-5xl p-6" aria-busy="true">サービスを読み込んでいます…</main>;
  if (!offering) return <main className="mx-auto max-w-5xl p-6"><p role="alert">{error}</p><button type="button" className="mt-4 min-h-11 rounded-lg border px-4 py-2" onClick={() => setRetry(value => value + 1)}>もう一度読み込む</button></main>;
  const historyHref = publicIntakeHistoryHref(intake?.mode, toAcademyContextHref("/academy/offering-applications/mine", offering.headquarters_id, "teach"));
  return <main className="mx-auto max-w-5xl bg-white px-4 py-8 sm:px-8">
    <header className="mb-6"><p className="text-sm text-[var(--mikke-muted)]">{offering.kind}</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">{offering.title}</h1></header>
    {instructorPage && <section className="mb-6 border-b border-[var(--mikke-line)] pb-5"><h2 className="text-lg font-bold">{instructorPage.profile.display_name}</h2>{instructorPage.profile.image_url && <img className="my-3 h-24 w-24 rounded-full object-cover" src={instructorPage.profile.image_url} alt="講師のプロフィール" />}<p className="whitespace-pre-wrap">{instructorPage.profile.bio}</p><p className="mt-3 text-sm">講座の内容は本部の情報を掲載しています。</p></section>}
    {offering.lp_blocks.length ? <LpContent minimumFontSize={9} standaloneButtons blocks={offering.lp_blocks} render={render} /> : offering.courses.map(course => <AcademyCourseCard key={course.id} course={course} hidePrice />)}
    {instructorPage && <><LpContent minimumFontSize={9} standaloneButtons blocks={instructorPage.lp_blocks} render={items => <AcademyLpRenderer blocks={items} />} /><p className="mt-4 whitespace-pre-wrap">{instructorPage.profile.application_note}</p></>}
    {instructorPage?.profile.contact_email && <p className="mt-3 break-all text-sm">講師へのお問い合わせ：{instructorPage.profile.contact_email}</p>}
    {offering.kind==='月額レッスン'&&<MonthlyPolicySummary monthly={intake?.formConfiguration?.monthly}/> }
    <section id="apply" className="mx-auto mt-8 max-w-xl border-t border-[var(--mikke-line)] pt-6">
      {checkoutHref ? <div role="status"><h2 className="text-xl font-bold">カード決済へ進みます</h2><p className="mt-3">画面が切り替わらない場合は、下のリンクから続けてください。</p><Link className="mt-4 inline-flex min-h-12 items-center font-bold text-[var(--mikke-primary)]" href={checkoutHref}>カード決済を続ける →</Link></div> : receipt ? <div role="status"><h2 className="text-xl font-bold">お申し込みを受け付けました</h2><p className="mt-3">{receipt.offering_title}</p><p>受付金額（税込） ¥{Number(receipt.price).toLocaleString("ja-JP")}</p><p className="mt-3">お支払いは、受付済みの方法に沿ってお手続きください。本部が入金を確認すると申込状況に反映されます。</p>{(receipt.payment_method ?? method) === "bank" && <p className="mt-2 text-sm">お振込みの名義は、お申込みのお名前と同じにしてください。</p>}{receipt.payment_method && isPublicPaymentMethod(receipt.payment_method) && <p>お支払い方法：{publicPaymentLabels[receipt.payment_method]}</p>}{receipt.payment_method === "external" && (receiptExternalUrl ? <a className="mt-3 inline-flex min-h-12 items-center underline" href={receiptExternalUrl} target="_blank" rel="noopener noreferrer">外部の決済ページで支払う ↗</a> : <p role="alert">決済ページを確認できません。本部へお問い合わせください。</p>)}<Link className="mt-4 inline-flex min-h-12 items-center font-bold text-[var(--mikke-primary)]" href={historyHref}>申込内容・教材を確認する →</Link></div> : <>
        <h2 className="text-lg font-bold">{purchase?.complete ? "申込内容の確認" : (purchase?.stage ?? 0) > 0 ? `第${purchase?.stage}講座のお支払い（税込）` : offering.courses.length > 1 ? "全講座セットのサービス価格（税込）" : "サービス価格（税込）"}</h2>
        {purchase && !purchase.complete && <p className="mt-2 text-2xl font-bold">¥{Number(purchase?.amount).toLocaleString("ja-JP")}</p>}
        {purchase && !purchase.complete && (purchase.stage ?? 0) > 0 && <p className="mt-2 font-bold">{purchase?.courseName || offering.courses[(purchase?.stage ?? 1) - 1]?.name}</p>}
        {offering.purchase_mode === "staged" && <p className="mt-2 text-sm">講座ごとにお申し込み・お支払いいただきます。前の講座の修了後、次の講座へ進めます。</p>}

        {!authReady ? <p>ログイン状態を確認しています…</p> : !userId ? <Link className="mt-5 flex min-h-14 w-full items-center justify-center rounded-xl bg-[var(--mikke-accent)] px-6 py-4 text-lg font-bold text-white" href={`/login?next=${encodeURIComponent(`/academy/${instructor ? "oi" : "o"}/${id}#apply`)}`}>ログインして申し込む</Link> : !purchaseReady ? <p role={viewerError?.scope===viewerScope?"alert":"status"}>{viewerError?.scope===viewerScope?viewerError.message:"今回お申し込みできる講座を確認しています…"}</p> : purchase?.blocked ? <div className="mt-4"><p>{purchase.complete ? "このサービスへの申込は完了しています。" : "前の講座の入金・修了を確認してから次へ進めます。"}</p><Link className="inline-flex min-h-12 items-center font-bold text-[var(--mikke-primary)]" href={historyHref}>申込内容・教材を確認する →</Link></div> : <form onSubmit={apply} className="mt-5 space-y-4">
          <label className="block">お名前<input className={inputClass} autoComplete="name" required maxLength={120} value={name} onChange={event => setName(event.target.value)} disabled={busy} /></label>
          <label className="block">連絡先のメールアドレス<input className={inputClass} type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy || !!intake} /></label>
          <p className="text-xs text-[var(--mikke-text-soft)]">受付などの自動通知には、mikke IDに登録した確認済みのメールアドレスを使います。</p>
          {intake?.eventRequired && <label className="block">開催日時・受付方法<select required className={inputClass} value={classId} disabled={busy} onChange={event=>setClassId(event.target.value)}><option value="">選択してください</option>{stageEvents.map(item=><option key={item.id} value={item.id}>{item.title} — {item.scheduleMode==='arranged_after_application'?'申込後に日程相談':item.startsAt?new Date(item.startsAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'日程未定'}</option>)}</select></label>}
          {formContext.schedule_mode==='arranged_after_application' && <p>日程はお申込み後、{intake?.mode==='instructor'?'講師':'本部'}と相談して決定します。ご希望の日程を入力してください。</p>}
          {intake && displayedFields.filter(field=>!['name','email','terms'].includes(field.id)).map(field=><label key={field.id} className="block">{field.label}{field.required?'（必須）':'（任意）'}{field.type==='textarea'?<textarea className={inputClass} rows={3} required={field.required} maxLength={applicationAnswerLimit(field.id)} value={answers[field.id]??''} disabled={busy} onChange={event=>setAnswers(current=>({...current,[field.id]:event.target.value}))}/>:field.type==='select'?<select className={inputClass} required={field.required} value={answers[field.id]??''} disabled={busy} onChange={event=>setAnswers(current=>({...current,[field.id]:event.target.value}))}><option value="">選択してください</option>{field.options?.map(option=><option key={option} value={option}>{option}</option>)}</select>:<input className={inputClass} type={field.type==='date'?'date':field.type==='tel'?'tel':'text'} required={field.required} maxLength={applicationAnswerLimit(field.id)} value={answers[field.id]??''} disabled={busy} onChange={event=>setAnswers(current=>({...current,[field.id]:event.target.value}))}/>}</label>)}
          {monthlyBlocked&&<p role="alert">月額レッスンの条件を確認できないため、現在お申し込みできません。本部へお問い合わせください。</p>}
          {formBlocked && <p role="alert">開催側のキット受け渡し方法が未設定のため、現在お申し込みできません。本部へお問い合わせください。</p>}
          <label className="block">お支払い方法<select className={inputClass} value={method} onChange={event => setMethod(event.target.value)} disabled={busy}>{paymentMethods.map(item => <option key={item} value={item}>{publicPaymentLabels[item]}</option>)}</select></label>
          {method === "bank" && <p className="mt-2 text-sm">お振込みの名義は、お申込みのお名前と同じにしてください。</p>}

          {method === "external" && <p className="text-sm">{externalUrl ? `申込後に外部の決済ページ（${new URL(externalUrl).hostname}）をご案内します。` : "外部の決済ページを確認できません。本部へお問い合わせください。"}</p>}
          {intake && <><details className="rounded-lg border border-[var(--mikke-line)] p-3"><summary>申込規約</summary><p className="mt-3 whitespace-pre-wrap text-sm">{intake.terms.body}</p></details><label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={agreed} disabled={busy} onChange={event => setAgreed(event.target.checked)} />申込規約を確認し、同意します</label></>}
          <p className="text-sm">{method === "card" ? "申込内容を保存してカード決済へ進みます。" : "送信すると、このサービスへの申込が確定します。お支払いは本部の案内をご確認ください。"}</p>
          <button className="flex min-h-14 w-full items-center justify-center rounded-xl bg-[var(--mikke-accent)] px-6 py-4 text-lg font-bold text-white disabled:opacity-50" disabled={busy || formBlocked || monthlyBlocked || (intake?.mode === "headquarters" && method === "external" && !externalUrl) || !paymentMethods.length || !Number.isFinite(purchase?.amount) || (!!intake && (!agreed || (intake.eventRequired && (!classId || !selectedEvent))))} type="submit">{busy ? "送信しています…" : method === "card" ? "カード決済へ進む" : "この内容で申し込む"}</button>
          <Link className="inline-flex min-h-11 items-center text-sm text-[var(--mikke-primary)]" href={historyHref}>自分の申込を確認する</Link>
        </form>}
      </>}
      {error && <p className="mt-4 text-red-700" role="alert">{error}</p>}
    </section>
  </main>;
}


