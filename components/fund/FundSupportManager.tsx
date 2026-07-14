"use client";

import { FormEvent, useState } from "react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { formatDate, formatYen } from "@/lib/format";
import { summarizeFundSupports, useFundProjects } from "@/lib/fund/store";
import {
  fundPaymentStatusLabels,
  fundSupportRecordStatusLabels,
  type FundPaymentStatus,
  type FundSupportRecordStatus
} from "@/lib/fund/types";

const paymentStatuses = Object.keys(fundPaymentStatusLabels) as FundPaymentStatus[];
const recordStatuses = Object.keys(fundSupportRecordStatusLabels) as FundSupportRecordStatus[];

export function FundSupportManager({ projectId }: { projectId: string }) {
  const { plans, supports, createSupport, updateSupport } = useFundProjects();
  const projectPlans = plans.filter((plan) => plan.projectId === projectId);
  const projectSupports = supports.filter((support) => support.projectId === projectId).sort((a, b) => b.supportedAt.localeCompare(a.supportedAt));
  const summary = summarizeFundSupports(projectSupports);
  const [supporterName, setSupporterName] = useState("");
  const [supporterEmail, setSupporterEmail] = useState("");
  const [publicName, setPublicName] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [planId, setPlanId] = useState(projectPlans[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [paymentStatus, setPaymentStatus] = useState<FundPaymentStatus>("pending");
  const [comment, setComment] = useState("");
  const [source, setSource] = useState("外部申込");
  const [supportedAt, setSupportedAt] = useState(new Date().toISOString().slice(0, 10));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supporterName.trim()) return;
    const selectedPlan = projectPlans.find((plan) => plan.id === planId);
    createSupport({
      projectId,
      planId,
      supporterName: supporterName.trim(),
      supporterEmail: supporterEmail.trim(),
      publicName: publicName.trim(),
      isAnonymous,
      supportType: selectedPlan?.planType ?? "support",
      amount: amount ? Number(amount) : null,
      quantity: Math.max(1, Number(quantity) || 1),
      paymentStatus,
      fulfillmentStatus: "waiting",
      recordStatus: "valid",
      comment: comment.trim(),
      source: source.trim(),
      supportedAt
    });
    setSupporterName("");
    setSupporterEmail("");
    setPublicName("");
    setIsAnonymous(false);
    setAmount("");
    setQuantity("1");
    setComment("");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="grid gap-3 border-b border-[var(--mikke-line)] pb-5 sm:grid-cols-4">
        <Summary label="応援者" value={`${summary.supporterCount}人`} />
        <Summary label="応援件数" value={`${summary.supportCount}件`} />
        <Summary label="数量" value={`${summary.quantity}件`} />
        <Summary label="確認済み金額" value={formatYen(summary.confirmedAmount)} />
      </div>

      <MikkeSection title="応援を手動登録">
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Field label="応援者名" required><input value={supporterName} onChange={(event) => setSupporterName(event.target.value)} className={inputClass} required /></Field>
          <Field label="メールアドレス"><input value={supporterEmail} onChange={(event) => setSupporterEmail(event.target.value)} type="email" className={inputClass} /></Field>
          <Field label="応援プラン">
            <select value={planId} onChange={(event) => setPlanId(event.target.value)} className={inputClass}>
              <option value="">プラン指定なし</option>
              {projectPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title}</option>)}
            </select>
          </Field>
          <Field label="応援日"><input value={supportedAt} onChange={(event) => setSupportedAt(event.target.value)} type="date" className={inputClass} /></Field>
          <Field label="金額（任意）"><input value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputClass} /></Field>
          <Field label="数量"><input value={quantity} onChange={(event) => setQuantity(event.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputClass} /></Field>
          <Field label="決済確認">
            <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as FundPaymentStatus)} className={inputClass}>
              {paymentStatuses.map((status) => <option key={status} value={status}>{fundPaymentStatusLabels[status]}</option>)}
            </select>
          </Field>
          <Field label="申込元"><input value={source} onChange={(event) => setSource(event.target.value)} className={inputClass} /></Field>
          <Field label="公開名（任意）"><input value={publicName} onChange={(event) => setPublicName(event.target.value)} className={inputClass} /></Field>
          <label className="flex items-end gap-2 pb-2 text-sm font-semibold"><input type="checkbox" checked={isAnonymous} onChange={(event) => setIsAnonymous(event.target.checked)} /> 匿名希望</label>
          <Field label="コメント・管理メモ" className="sm:col-span-2"><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={2} className={`${inputClass} resize-none`} /></Field>
          <button type="submit" className="rounded-lg bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white sm:col-span-2">応援を登録</button>
        </form>
        <p className="mt-3 text-xs leading-5 text-[var(--mikke-muted)]">カード番号、銀行情報、配送先はFundに入力しないでください。決済は外部サービスで管理します。</p>
      </MikkeSection>

      <MikkeSection title="応援者一覧">
        {projectSupports.length > 0 ? (
          <div className="divide-y divide-[var(--mikke-line)]">
            {projectSupports.map((support) => (
              <div key={support.id} className="py-4 first:pt-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">{support.supporterName}</p>
                    <p className="mt-1 text-xs text-[var(--mikke-muted)]">{support.supporterEmail || "メール未登録"} ・ {formatDate(support.supportedAt)}</p>
                  </div>
                  <MikkeStatusBadge tone={support.paymentStatus === "confirmed" ? "success" : "muted"} className="px-2 py-1">{fundPaymentStatusLabels[support.paymentStatus]}</MikkeStatusBadge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="text-xs font-bold">決済確認
                    <select value={support.paymentStatus} onChange={(event) => updateSupport(support.id, { paymentStatus: event.target.value as FundPaymentStatus })} className={smallSelectClass}>
                      {paymentStatuses.map((status) => <option key={status} value={status}>{fundPaymentStatusLabels[status]}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-bold">集計区分
                    <select value={support.recordStatus} onChange={(event) => updateSupport(support.id, { recordStatus: event.target.value as FundSupportRecordStatus })} className={smallSelectClass}>
                      {recordStatuses.map((status) => <option key={status} value={status}>{fundSupportRecordStatusLabels[status]}</option>)}
                    </select>
                  </label>
                </div>
                <p className="mt-2 text-xs text-[var(--mikke-muted)]">数量 {support.quantity}・{support.amount != null ? formatYen(support.amount) : "金額なし"}・{support.source || "申込元未登録"}</p>
              </div>
            ))}
          </div>
        ) : <MikkeEmptyState title="応援者はまだ登録されていません" helper="外部申込を確認したら、ここへ手動登録します。" />}
      </MikkeSection>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold text-[var(--mikke-muted)]">{label}</p><p className="mt-1 text-lg font-bold">{value}</p></div>; }
const inputClass = "mt-1.5 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--mikke-accent)]";
const smallSelectClass = "mt-1.5 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-2 py-2 text-xs outline-none";
function Field({ label, required = false, className = "", children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) { return <label className={`block ${className}`}><span className="text-xs font-bold">{label}{required ? <span className="ml-1 text-[var(--mikke-accent)]">*</span> : null}</span>{children}</label>; }
