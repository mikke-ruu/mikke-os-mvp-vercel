"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { getAcademyRouteContext, toAcademyContextHref } from "@/lib/academy/access-context";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { supabase } from "@/lib/supabase/client";

type Application = {
  id: string; headquarters_id: string; offering_title: string;
  applicant_name: string; applicant_email: string; price: number; currency: string;
  payment_method: string; status: string; paid_at: string | null; created_at: string;
  course_snapshot: { id: string; name: string; learner_access_mode?: string }[];
  offering_id: string; stage_index: number; completed_at: string | null;
  purchase_snapshot: { completion_mode?: "learner" | "hq"; course_ids?: string[] };
};

type Audience = "hq" | "learner" | "instructor";
export function OfferingApplications({ audience }: { audience: Audience }) {
  const { profile } = useAuth();
  const contextId = getAcademyRouteContext()?.academyId;
  return <Applications key={`${profile.user_id}:${contextId ?? ""}:${audience}`} userId={profile.user_id} academyId={contextId} audience={audience} />;
}

function Applications({ userId, academyId, audience }: { userId: string; academyId?: string; audience: Audience }) {
  const [rows, setRows] = useState<Application[]>([]);
  const [instructorPages, setInstructorPages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(""); setRows([]); setInstructorPages({});
    async function load() {
      try {
        let query = supabase.from("academy_offering_applications").select("id,offering_id,headquarters_id,offering_title,applicant_name,applicant_email,price,currency,payment_method,status,paid_at,created_at,course_snapshot,stage_index,completed_at,purchase_snapshot").order("created_at", { ascending: false });
        let linkQuery = supabase.from("academy_instructor_offering_application_links").select("application_id,page_id");
        if (audience === "hq") {
          const hq = await getOwnedHeadquarters(userId, academyId);
          if (!hq) throw new Error("no access");
          query = query.eq("headquarters_id", hq.id);
          linkQuery = linkQuery.eq("headquarters_id", hq.id);
        } else if (audience === "learner") {
          query = query.eq("learner_user_id", userId);
          linkQuery = linkQuery.eq("learner_user_id", userId);
          if (academyId) query = query.eq("headquarters_id", academyId);
          if (academyId) linkQuery = linkQuery.eq("headquarters_id", academyId);
        } else {
          linkQuery = linkQuery.eq("owner_user_id", userId);
          if (academyId) linkQuery = linkQuery.eq("headquarters_id", academyId);
          if (academyId) query = query.eq("headquarters_id", academyId);
        }
        const { data: links, error: linkError } = await linkQuery;
        if (linkError) throw linkError;
        if (audience === "instructor") {
          const assignedIds = (links ?? []).map(link => link.application_id);
          if (assignedIds.length === 0) return;
          query = query.in("id", assignedIds);
        }
        const { data, error: readError } = await query;
        if (readError) throw readError;
        if (!cancelled) {
          setRows((data ?? []) as Application[]);
          setInstructorPages(Object.fromEntries((links ?? []).map(link => [link.application_id, link.page_id])));
        }
      } catch { if (!cancelled) setError("申込を読み込めませんでした。時間をおいて再読み込みしてください。"); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [academyId, audience, userId, refresh]);

  async function confirmPayment(row: Application) {
    if (pending.current || audience !== "hq" || row.status !== "pending" || !["bank", "onsite"].includes(row.payment_method)) return;
    pending.current = true; setSaving(true); setError("");
    try {
      const { error: saveError } = await supabase.rpc("academy_confirm_offering_payment", { p_application_id: row.id });
      if (saveError) throw saveError;
      setConfirmId(null); setRefresh(value => value + 1);
    } catch { setError("入金確認を保存できませんでした。再読み込みして申込の状態を確認してください。"); }
    finally { pending.current = false; setSaving(false); }
  }

  async function completeCourse(row: Application) {
    if (pending.current || audience === "instructor" || row.status !== "paid" || row.completed_at || (audience === "learner" && (row.purchase_snapshot?.completion_mode ?? "hq") !== "learner")) return;
    pending.current = true; setSaving(true); setError("");
    try {
      const { error: completeError } = await supabase.rpc("academy_complete_offering_course", { p_application_id: row.id });
      if (completeError) throw completeError;
      setRefresh(value => value + 1);
    } catch { setError("修了を保存できませんでした。修了の確認方法と申込状態を確認してください。"); }
    finally { pending.current = false; setSaving(false); }
  }

  return <div className="mx-auto max-w-3xl space-y-4">
    <p className="text-sm text-[var(--mikke-muted)]">{audience === "hq" ? "募集ページから届いた申込です。振込・現地払いの受領を確認してから教材を利用可能にします。カード決済の確認には使えません。" : audience === "instructor" ? "自分の募集ページから届いた申込です。入金確認と本部による修了確認は本部で行います。" : "募集ページから申し込んだ内容を確認できます。入金確認後に教材の利用が始まります。"}</p>
    <button type="button" disabled={loading || saving} onClick={() => setRefresh(value => value + 1)} className="min-h-11 text-sm font-bold text-[var(--mikke-primary)] disabled:opacity-50">再読み込み</button>
    {error ? <p role="alert" className="text-sm text-[var(--mikke-danger)]">{error}</p> : null}
    {loading ? <p role="status">読み込み中…</p> : !error && rows.length === 0 ? <p className="py-6 text-sm">募集ページからの申込はまだありません。</p> : null}
    {rows.map(row => <section key={row.id} className="border-t border-[var(--mikke-line)] py-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">{row.offering_title}</h2><span className="text-sm font-bold">{row.status === "paid" ? "入金確認済み" : row.status === "pending" ? "入金確認待ち" : "状態を確認中"}</span></div>
      <p className="mt-2 text-xs text-[var(--mikke-muted)]">申込日 {new Date(row.created_at).toLocaleDateString("ja-JP")} / 受付番号 {row.id}</p>
      {audience !== "learner" ? <p className="mt-2 break-all text-sm">{row.applicant_name} / {row.applicant_email}</p> : null}
      <p className="mt-3 font-bold">申込金額（税込） {Number.isFinite(Number(row.price)) ? `¥${Number(row.price).toLocaleString("ja-JP")}` : "確認が必要です"}</p>
      <p className="text-sm">{row.payment_method === "bank" ? "銀行振込" : row.payment_method === "onsite" ? "現地払い" : "支払方法を確認してください"}</p>
      <details className="mt-3 text-sm"><summary className="cursor-pointer py-2">申込時の講座内容</summary><ul className="list-disc space-y-1 pl-5">{Array.isArray(row.course_snapshot) ? row.course_snapshot.map(course => <li key={course.id}>{course.name}</li>) : null}</ul></details>
      {audience === "learner" && row.status === "paid" ? <Link className="mt-3 inline-flex min-h-11 items-center font-bold text-[var(--mikke-primary)]" href={toAcademyContextHref("/academy/portal/study?view=learner", row.headquarters_id, "teach")}>教材を確認する →</Link> : null}
      {(row.stage_index > 0 || row.course_snapshot.some(course => course.learner_access_mode === "days_after_completion")) && <div className="mt-3 text-sm">
        <p>{row.stage_index > 0 ? `第${row.stage_index}講座` : "まとめて申し込んだ講座"} {row.completed_at ? "修了済み" : ""}</p>
        {row.status === "paid" && !row.completed_at && (audience === "hq" || (audience === "learner" && (row.purchase_snapshot?.completion_mode ?? "hq") === "learner")) ? <><p className="mt-2">{row.stage_index > 0 ? "受講が終わったら修了を記録してください。" : "対象の全講座を受講し終わってから修了を記録してください。まとめて修了扱いになります。"}修了後に閲覧期間が始まる教材は、この操作で期間が始まります。</p><button type="button" className="mt-2 min-h-11 rounded-lg border border-[var(--mikke-line)] px-4 font-bold" disabled={saving} onClick={() => void completeCourse(row)}>修了を記録する</button></> : null}
        {row.status === "paid" && !row.completed_at && audience === "learner" && (row.purchase_snapshot?.completion_mode ?? "hq") === "hq" && <p>本部の修了確認をお待ちください。</p>}
        {audience === "learner" && row.stage_index > 0 && row.completed_at && row.stage_index < (row.purchase_snapshot?.course_ids?.length ?? 0) && <Link className="inline-flex min-h-11 items-center font-bold text-[var(--mikke-primary)]" href={instructorPages[row.id] ? `/academy/oi/${instructorPages[row.id]}#apply` : `/academy/o/${row.offering_id}#apply`}>次の講座へ進む →</Link>}
      </div>}
      {audience === "hq" && row.status === "pending" && ["bank", "onsite"].includes(row.payment_method) ? confirmId === row.id ? <div className="mt-3 space-y-2 bg-[var(--mikke-surface-soft)] p-3"><p className="text-sm">上記の金額を受け取りましたか？確認すると対象講座の教材が利用可能になります。返金や取消の操作ではありません。</p><div className="flex flex-wrap gap-3"><button type="button" disabled={saving} onClick={() => void confirmPayment(row)} className="min-h-11 rounded-lg bg-[var(--mikke-primary)] px-4 font-bold text-white disabled:opacity-50">{saving ? "保存中…" : "受領済みとして確定する"}</button><button type="button" disabled={saving} onClick={() => setConfirmId(null)} className="min-h-11 px-3">戻る</button></div></div> : <button type="button" disabled={saving} onClick={() => setConfirmId(row.id)} className="mt-3 min-h-11 rounded-lg border border-[var(--mikke-line)] px-4 font-bold">入金を確認する</button> : null}
    </section>)}
  </div>;
}
