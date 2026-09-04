"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BadgeMinus, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { grantAcademyBillingExclusion, loadAcademyBillingExclusions, revokeAcademyBillingExclusion, type AcademyBillingExclusionState } from "@/lib/hq/billing-exclusions";

function formatDate(value: string | null) {
  if (!value) return "期限なし";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function BillingExclusionsPage() {
  const { profile } = useAuth();
  const [state, setState] = useState<AcademyBillingExclusionState | null>(null);
  const [headquartersId, setHeadquartersId] = useState("");
  const [targetHandle, setTargetHandle] = useState("");
  const [reason, setReason] = useState("テスト検証用アカウント");
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const isAyumi = profile.handle.toLowerCase() === "ayumi";

  async function load() {
    setMessage("");
    try {
      const next = await loadAcademyBillingExclusions();
      setState(next);
      setHeadquartersId((current) => current || next.headquarters[0]?.id || "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "課金対象外設定を読み込めませんでした。");
    }
  }

  useEffect(() => { if (isAyumi) void load(); }, [isAyumi]);
  const active = useMemo(() => state?.exclusions.filter((item) => item.active) ?? [], [state]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      await grantAcademyBillingExclusion({ headquartersId, targetHandle: targetHandle.trim(), reason: reason.trim(), effectiveUntil: effectiveUntil ? new Date(`${effectiveUntil}T23:59:59+09:00`).toISOString() : null });
      setTargetHandle("");
      setMessage("課金対象外アカウントとして登録しました。次回の人数見積から除外されます。");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登録できませんでした。");
    } finally { setBusy(false); }
  }

  async function revoke(id: string) {
    if (!window.confirm("このアカウントを課金対象外から解除しますか？")) return;
    setBusy(true); setMessage("");
    try {
      await revokeAcademyBillingExclusion(id, "@ayumiによる課金対象外設定の解除");
      setMessage("課金対象外設定を解除しました。次回の人数見積から課金対象へ戻ります。");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "解除できませんでした。");
    } finally { setBusy(false); }
  }

  if (!isAyumi) return <section className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-white p-6"><h1 className="text-lg font-bold">@ayumi 専用画面です</h1><p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">ほかの本部Owner・管理者は、課金対象外設定を表示・変更できません。</p></section>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header><p className="text-xs font-bold tracking-[0.15em] text-[var(--mikke-primary)]">BILLING CONTROL</p><h1 className="mt-2 text-2xl font-bold">課金対象外アカウント</h1><p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">テスト・運営用のmikke IDを、選択したAcademy本部の講師人数課金から除外します。</p></header>
      <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><ShieldCheck className="mt-0.5 shrink-0" size={19} />この画面は @ayumi だけが操作できます。ここでの登録はAcademy利用権の付与やStripe契約の解約ではありません。</p>
      {message ? <p aria-live="polite" className="rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-3 text-sm font-semibold">{message}</p> : null}
      <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm md:p-5">
        <div className="flex items-center gap-2"><BadgeMinus size={19} className="text-[var(--mikke-primary)]"/><h2 className="font-bold">mikke IDを登録</h2></div>
        <form onSubmit={submit} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block"><span className="text-sm font-bold">対象のAcademy本部</span><select required value={headquartersId} onChange={(event) => setHeadquartersId(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-3 text-sm"><option value="">選択してください</option>{state?.headquarters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="block"><span className="text-sm font-bold">課金対象外にするmikke ID</span><input required value={targetHandle} onChange={(event) => setTargetHandle(event.target.value)} placeholder="@example" maxLength={31} autoCapitalize="none" className="mt-2 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-3 text-sm"/></label>
          <label className="block md:col-span-2"><span className="text-sm font-bold">理由</span><input required value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={160} className="mt-2 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-3 text-sm"/></label>
          <label className="block"><span className="text-sm font-bold">終了日（任意）</span><input type="date" value={effectiveUntil} onChange={(event) => setEffectiveUntil(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-3 text-sm"/><span className="mt-1 block text-xs text-[var(--mikke-muted)]">空欄の場合は、解除するまで継続します。</span></label>
          <div className="flex items-end"><button type="submit" disabled={busy || !state || !headquartersId} className="w-full rounded-xl bg-[var(--mikke-primary)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "処理中…" : "課金対象外として登録"}</button></div>
        </form>
      </section>
      <section><h2 className="mb-3 font-bold">現在の課金対象外アカウント</h2>{active.length === 0 ? <p className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-white p-6 text-center text-sm text-[var(--mikke-muted)]">まだ登録されていません。</p> : <div className="space-y-3">{active.map((item) => <article key={item.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-all font-bold">@{item.targetHandle}</p><p className="mt-1 break-words text-sm text-[var(--mikke-muted)]">{item.headquartersName}</p><p className="mt-2 break-words text-xs leading-5 text-[var(--mikke-muted)]">{item.reason} ・ {formatDate(item.effectiveFrom)}から ・ {item.effectiveUntil ? `${formatDate(item.effectiveUntil)}まで` : "期限なし"}</p></div><button type="button" disabled={busy} onClick={() => void revoke(item.id)} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">課金対象外を解除</button></div></article>)}</div>}</section>
    </div>
  );
}
