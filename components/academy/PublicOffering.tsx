"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase/client";
import type { AcademyOffering } from "@/lib/academy/offerings";
import { toAcademyContextHref } from "@/lib/academy/access-context";
import { AcademyCourseCard, type AcademyCourseCardInfo } from "./AcademyCourseCard";
import { AcademyContentRenderer } from "./AcademyContentRenderer";
import { LpContent } from "@/components/mikkeos/page-builder/LpDesign";
import type { LpBlock } from "@/components/mikkeos/page-builder/lp-design";
import { offeringPurchaseState, type OfferingPurchaseHistory } from "@/lib/academy/offering-purchase";

type PublicData = Pick<AcademyOffering, "id" | "headquarters_id" | "title" | "kind" | "price" | "currency" | "payment_methods" | "lp_blocks" | "purchase_mode" | "stage_prices" | "course_ids"> & { courses: (AcademyCourseCardInfo & { id: string })[] };
type Receipt = { id: string; price: number; status: string; headquarters_id: string; offering_title: string };
type InstructorPage = { id: string; profile: { display_name?: string; bio?: string; image_url?: string; contact_email?: string; application_note?: string }; lp_blocks: LpBlock[] };
const inputClass = "mt-1 block min-h-12 w-full rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2";

export function PublicOffering({ id, instructor = false }: { id: string; instructor?: boolean }) {
  const [offering, setOffering] = useState<PublicData | null>(null);
  const [instructorPage, setInstructorPage] = useState<InstructorPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState("bank");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [history, setHistory] = useState<OfferingPurchaseHistory[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const pending = useRef(false);
  const requestToken = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setReceipt(null); setOffering(null); setInstructorPage(null); requestToken.current = null;
    void supabase.rpc(instructor ? "academy_get_public_instructor_offering" : "academy_get_public_offering", instructor ? { p_page_id: id } : { p_offering_id: id }).then(({ data, error: readError }) => {
      if (!active) return;
      if (readError) setError("募集を読み込めませんでした。時間をおいて再読み込みしてください。");
      else if (!data) setError("この募集は現在公開されていません。");
      else {
        const details = (instructor ? data.offering : data) as PublicData;
        setOffering(details); setMethod(details.payment_methods[0] ?? "bank");
        if (instructor) setInstructorPage(data.page as InstructorPage);
      }
      setLoading(false);
    });
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUserId(data.user?.id ?? null); setEmail(data.user?.email ?? ""); setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) { setUserId(session?.user.id ?? null); setAuthReady(true); }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [id, instructor]);

  useEffect(() => {
    let active = true;
    setHistoryReady(false); setHistory([]);
    if (!userId || !offering) return () => { active = false; };
    void supabase.from("academy_offering_applications").select("id,offering_id,headquarters_id,offering_title,status,price,stage_index,completed_at,purchase_snapshot").eq("offering_id", offering.id).eq("learner_user_id", userId).then(({ data, error: historyError }) => {
      if (!active) return;
      if (historyError) setError("申込履歴を確認できませんでした。再読み込みしてください。");
      else { setHistory((data ?? []) as OfferingPurchaseHistory[]); setHistoryReady(true); }
    });
    return () => { active = false; };
  }, [offering, userId]);
  const purchase = offering ? offeringPurchaseState(offering, history) : null;
  const paymentMethods = purchase?.current?.purchase_snapshot?.payment_methods ?? offering?.payment_methods ?? [];
  useEffect(() => { if (paymentMethods.length && !paymentMethods.includes(method as "bank" | "onsite")) setMethod(paymentMethods[0]); }, [paymentMethods, method]);

  async function apply(event: FormEvent) {
    event.preventDefault();
    if (pending.current || !offering || !userId || !historyReady || !purchase || purchase.blocked || !Number.isFinite(purchase.amount)) return;
    pending.current = true; setBusy(true); setError("");
    requestToken.current ??= crypto.randomUUID();
    try {
      const { data, error: submitError } = await supabase.rpc(instructor ? "academy_submit_instructor_offering_application" : "academy_submit_offering_application", {
        ...(instructor ? { p_page_id: id } : { p_offering_id: id }), p_request_token: requestToken.current,
        p_applicant_name: name.trim(), p_applicant_email: email.trim(), p_payment_method: method,
        p_expected_price: purchase.amount,
      });
      if (submitError) throw submitError;
      if (!data?.id) throw new Error("受付結果を確認できませんでした。");
      setReceipt(data as Receipt);
    } catch (submitError) {
      const message = typeof submitError === "object" && submitError !== null && "message" in submitError ? String(submitError.message) : "";
      setError(message.includes("offering_price_changed") ? "募集価格が更新されています。再読み込みして価格を確認してからお申し込みください。" : "申込の受付を確認できませんでした。申込一覧を確認し、受付がない場合はもう一度お試しください。");
    } finally { pending.current = false; setBusy(false); }
  }

  function render(blocks: LpBlock[]) {
    return blocks.map(block => {
      if (block.lp?.reference) {
        const course = offering?.courses.find(item => item.id === block.lp!.reference!.id);
        return course ? <AcademyCourseCard key={block.id} course={course} imageSide={block.lp.reference.imageSide} hidePrice /> : null;
      }
      return <AcademyContentRenderer key={block.id} blocks={[block]} />;
    });
  }

  if (loading) return <main className="mx-auto max-w-5xl p-6" aria-busy="true">募集を読み込んでいます…</main>;
  if (!offering) return <main className="mx-auto max-w-5xl p-6"><p role="alert">{error}</p></main>;
  const historyHref = toAcademyContextHref("/academy/offering-applications/mine", offering.headquarters_id, "teach");
  return <main className="mx-auto max-w-5xl bg-white px-4 py-8 sm:px-8">
    <header className="mb-6"><p className="text-sm text-[var(--mikke-muted)]">{offering.kind}</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">{offering.title}</h1></header>
    {instructorPage && <section className="mb-6 border-b border-[var(--mikke-line)] pb-5"><h2 className="text-lg font-bold">{instructorPage.profile.display_name}</h2>{instructorPage.profile.image_url && <img className="my-3 h-24 w-24 rounded-full object-cover" src={instructorPage.profile.image_url} alt="講師のプロフィール" />}<p className="whitespace-pre-wrap">{instructorPage.profile.bio}</p><p className="mt-3 text-sm">講座の内容は本部の情報を掲載しています。</p></section>}
    {offering.lp_blocks.length ? <LpContent blocks={offering.lp_blocks} render={render} /> : offering.courses.map(course => <AcademyCourseCard key={course.id} course={course} hidePrice />)}
    {instructorPage && <><LpContent blocks={instructorPage.lp_blocks} render={items => <AcademyContentRenderer blocks={items} />} /><p className="mt-4 whitespace-pre-wrap">{instructorPage.profile.application_note}</p></>}
    {instructorPage?.profile.contact_email && <p className="mt-3 break-all text-sm">講師へのお問い合わせ：{instructorPage.profile.contact_email}</p>}
    <section id="apply" className="mx-auto mt-8 max-w-xl border-t border-[var(--mikke-line)] pt-6">
      {receipt ? <div role="status"><h2 className="text-xl font-bold">お申し込みを受け付けました</h2><p className="mt-3">{receipt.offering_title}</p><p>受付金額（税込） ¥{Number(receipt.price).toLocaleString("ja-JP")}</p><p className="mt-3">この画面では決済は行われません。お支払いについては本部の案内をご確認ください。</p><Link className="mt-4 inline-flex min-h-12 items-center font-bold text-[var(--mikke-primary)]" href={historyHref}>申込内容・教材を確認する →</Link></div> : <>
        <h2 className="text-lg font-bold">{purchase?.complete ? "申込内容の確認" : (purchase?.stage ?? 0) > 0 ? `第${purchase?.stage}講座のお支払い（税込）` : offering.courses.length > 1 ? "全講座セットの募集価格（税込）" : "募集価格（税込）"}</h2>
        {!purchase?.complete && <p className="mt-2 text-2xl font-bold">¥{Number(purchase?.amount).toLocaleString("ja-JP")}</p>}
        {!purchase?.complete && (purchase?.stage ?? 0) > 0 && <p className="mt-2 font-bold">{purchase?.courseName || offering.courses[(purchase?.stage ?? 1) - 1]?.name}</p>}
        {offering.purchase_mode === "staged" && <p className="mt-2 text-sm">講座ごとにお申し込み・お支払いいただきます。前の講座の修了後、次の講座へ進めます。</p>}
        <p className="mt-3 text-sm">カード決済（Stripe）は準備中です。</p>
        {!authReady ? <p>ログイン状態を確認しています…</p> : !userId ? <Link className="mt-5 flex min-h-14 w-full items-center justify-center rounded-xl bg-[var(--mikke-accent)] px-6 py-4 text-lg font-bold text-white" href={`/login?next=${encodeURIComponent(`/academy/${instructor ? "oi" : "o"}/${id}#apply`)}`}>ログインして申し込む</Link> : !historyReady ? <p>申込履歴を確認しています…</p> : purchase?.blocked ? <div className="mt-4"><p>{purchase.complete ? "この募集への申込は完了しています。" : "前の講座の入金・修了を確認してから次へ進めます。"}</p><Link className="inline-flex min-h-12 items-center font-bold text-[var(--mikke-primary)]" href={historyHref}>申込内容・教材を確認する →</Link></div> : <form onSubmit={apply} className="mt-5 space-y-4">
          <label className="block">お名前<input className={inputClass} autoComplete="name" required maxLength={120} value={name} onChange={event => setName(event.target.value)} disabled={busy} /></label>
          <label className="block">メールアドレス<input className={inputClass} type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></label>
          <label className="block">お支払い方法<select className={inputClass} value={method} onChange={event => setMethod(event.target.value)} disabled={busy}>{paymentMethods.map(item => <option key={item} value={item}>{item === "onsite" ? "現地でお支払い" : "銀行振込"}</option>)}</select></label>
          <p className="text-sm">送信すると、この募集への申込が確定します。お支払いは本部の案内をご確認ください。</p>
          <button className="flex min-h-14 w-full items-center justify-center rounded-xl bg-[var(--mikke-accent)] px-6 py-4 text-lg font-bold text-white disabled:opacity-50" disabled={busy || !paymentMethods.length || !Number.isFinite(purchase?.amount)} type="submit">{busy ? "送信しています…" : "この内容で申し込む"}</button>
          <Link className="inline-flex min-h-11 items-center text-sm text-[var(--mikke-primary)]" href={historyHref}>自分の申込を確認する</Link>
        </form>}
      </>}
      {error && <p className="mt-4 text-red-700" role="alert">{error}</p>}
    </section>
  </main>;
}
