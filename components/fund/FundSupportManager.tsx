"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { formatDate, formatYen } from "@/lib/format";
import { createFundPaymentActivity, createFundSupportActivity } from "@/lib/fund/activity";
import {
  createFundSupportInvite,
  getFundSupportIdentityStatuses,
  revokeFundSupportInvite,
  updateOwnerFundParticipationConsent,
  type FundParticipation,
  type FundSupportIdentityStatus
} from "@/lib/fund/identity";
import { summarizeFundSupports, useFundProjects } from "@/lib/fund/store";
import {
  fundPaymentStatusLabels,
  fundSupportRecordStatusLabels,
  type FundPaymentStatus,
  type FundSupport,
  type FundSupportRecordStatus
} from "@/lib/fund/types";
import { useUnifiedActivityLogs } from "@/lib/mikkeos/activity-client-store";

const paymentStatuses = Object.keys(fundPaymentStatusLabels) as FundPaymentStatus[];
const recordStatuses = Object.keys(fundSupportRecordStatusLabels) as FundSupportRecordStatus[];

export function FundSupportManager({ projectId }: { projectId: string }) {
  const { user, profile } = useAuth();
  const { projects, plans, supports, createSupport, updateSupport } = useFundProjects(profile.id);
  const { addLog, removeLog } = useUnifiedActivityLogs();
  const project = projects.find((item) => item.id === projectId);
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
  const [identityStatuses, setIdentityStatuses] = useState<Record<string, FundSupportIdentityStatus>>({});
  const [identityLoadError, setIdentityLoadError] = useState("");
  const [identityAction, setIdentityAction] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<{ supportId: string; message: string } | null>(null);
  const [inviteDraft, setInviteDraft] = useState<{ supportId: string; claimId: string; inviteUrl: string; expiresAt: string } | null>(null);
  const supportIdsKey = projectSupports.map((support) => support.id).join("|");

  useEffect(() => {
    if (!planId && projectPlans.length > 0) setPlanId(projectPlans[0].id);
  }, [planId, projectPlans]);

  useEffect(() => {
    let cancelled = false;
    const sourceLocalIds = supportIdsKey ? supportIdsKey.split("|") : [];
    setIdentityLoadError("");
    getFundSupportIdentityStatuses(sourceLocalIds).then((items) => {
      if (cancelled) return;
      setIdentityStatuses(Object.fromEntries(items.map((item) => [item.sourceLocalId, item])));
    }).catch(() => {
      if (!cancelled) setIdentityLoadError("Mikke IDとの連携状態を読み込めませんでした。");
    });
    return () => { cancelled = true; };
  }, [supportIdsKey]);

  async function issueMikkeInvite(support: FundSupport) {
    if (!project || support.recordStatus !== "valid") return;
    setIdentityAction(`issue:${support.id}`);
    setInviteError(null);
    setInviteDraft(null);
    try {
      const claim = await createFundSupportInvite({
        project,
        support,
        owner: { userId: user.id, profileId: profile.id }
      });
      setIdentityStatuses((current) => ({
        ...current,
        [support.id]: {
          sourceLocalId: support.id,
          activeClaim: { id: claim.claimId, expiresAt: claim.expiresAt },
          participation: current[support.id]?.participation ?? null
        }
      }));
      setInviteDraft({
        supportId: support.id,
        claimId: claim.claimId,
        inviteUrl: `${window.location.origin}/fund/invite/${claim.inviteToken}`,
        expiresAt: claim.expiresAt
      });
    } catch (error) {
      setInviteError({ supportId: support.id, message: error instanceof Error ? error.message : "招待を作成できませんでした。" });
    } finally {
      setIdentityAction(null);
    }
  }

  async function revokeMikkeInvite(support: FundSupport, claimId: string) {
    setIdentityAction(`revoke:${support.id}`);
    setInviteError(null);
    try {
      await revokeFundSupportInvite(claimId);
      setIdentityStatuses((current) => ({
        ...current,
        [support.id]: {
          sourceLocalId: support.id,
          activeClaim: null,
          participation: current[support.id]?.participation ?? null
        }
      }));
      if (inviteDraft?.claimId === claimId) setInviteDraft(null);
    } catch (error) {
      setInviteError({ supportId: support.id, message: error instanceof Error ? error.message : "招待を取り消せませんでした。" });
    } finally {
      setIdentityAction(null);
    }
  }

  async function changeOwnerConsent(
    support: FundSupport,
    participationId: string,
    nextStatus: FundParticipation["owner_consent_status"]
  ) {
    setIdentityAction(`owner-consent:${support.id}`);
    setInviteError(null);
    try {
      await updateOwnerFundParticipationConsent({
        participationId,
        ownerConsentStatus: nextStatus
      });
      setIdentityStatuses((current) => {
        const currentStatus = current[support.id];
        if (!currentStatus?.participation) return current;
        return {
          ...current,
          [support.id]: {
            ...currentStatus,
            participation: {
              ...currentStatus.participation,
              ownerConsentStatus: nextStatus
            }
          }
        };
      });
    } catch (error) {
      setInviteError({ supportId: support.id, message: error instanceof Error ? error.message : "Storyの公開設定を変更できませんでした。" });
    } finally {
      setIdentityAction(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supporterName.trim()) return;
    const selectedPlan = projectPlans.find((plan) => plan.id === planId);
    const support = createSupport({
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
    if (project) {
      addLog(createFundSupportActivity(project, support));
      if (support.paymentStatus === "confirmed") addLog(createFundPaymentActivity(project, support));
    }
    setSupporterName("");
    setSupporterEmail("");
    setPublicName("");
    setIsAnonymous(false);
    setAmount("");
    setQuantity("1");
    setComment("");
  }

  function changePaymentStatus(supportId: string, nextStatus: FundPaymentStatus) {
    const support = projectSupports.find((item) => item.id === supportId);
    if (!support) return;
    updateSupport(supportId, { paymentStatus: nextStatus });
    if (project && nextStatus === "confirmed" && support.recordStatus === "valid") {
      addLog(createFundPaymentActivity(project, { ...support, paymentStatus: nextStatus }));
    } else {
      removeLog("fund", supportId, "fund_payment_confirmed");
    }
  }

  function changeRecordStatus(supportId: string, nextStatus: FundSupportRecordStatus) {
    const support = projectSupports.find((item) => item.id === supportId);
    if (!support) return;
    updateSupport(supportId, { recordStatus: nextStatus });
    if (project && nextStatus === "valid") {
      addLog(createFundSupportActivity(project, { ...support, recordStatus: nextStatus }));
      if (support.paymentStatus === "confirmed") addLog(createFundPaymentActivity(project, support));
      return;
    }
    removeLog("fund", supportId, "fund_support_recorded");
    removeLog("fund", supportId, "fund_payment_confirmed");
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
        {identityLoadError ? <p className="mb-3 text-xs font-semibold text-[var(--mikke-danger)]">{identityLoadError}</p> : null}
        {projectSupports.length > 0 ? (
          <div className="divide-y divide-[var(--mikke-line)]">
            {projectSupports.map((support) => (
              <div key={support.id} className="py-4 first:pt-0">
                {(() => {
                  const identityStatus = identityStatuses[support.id];
                  const activeClaim = identityStatus?.activeClaim;
                  const participation = identityStatus?.participation;
                  const isIssuing = identityAction === `issue:${support.id}`;
                  const isRevoking = identityAction === `revoke:${support.id}`;
                  const isChangingOwnerConsent = identityAction === `owner-consent:${support.id}`;
                  return <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">{support.supporterName}</p>
                    <p className="mt-1 text-xs text-[var(--mikke-muted)]">{support.supporterEmail || "メール未登録"} ・ {formatDate(support.supportedAt)}</p>
                  </div>
                  <MikkeStatusBadge tone={support.paymentStatus === "confirmed" ? "success" : "muted"} className="px-2 py-1">{fundPaymentStatusLabels[support.paymentStatus]}</MikkeStatusBadge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="text-xs font-bold">決済確認
                    <select value={support.paymentStatus} onChange={(event) => changePaymentStatus(support.id, event.target.value as FundPaymentStatus)} className={smallSelectClass}>
                      {paymentStatuses.map((status) => <option key={status} value={status}>{fundPaymentStatusLabels[status]}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-bold">集計区分
                    <select value={support.recordStatus} onChange={(event) => changeRecordStatus(support.id, event.target.value as FundSupportRecordStatus)} className={smallSelectClass}>
                      {recordStatuses.map((status) => <option key={status} value={status}>{fundSupportRecordStatusLabels[status]}</option>)}
                    </select>
                  </label>
                </div>
                <p className="mt-2 text-xs text-[var(--mikke-muted)]">数量 {support.quantity}・{support.amount != null ? formatYen(support.amount) : "金額なし"}・{support.source || "申込元未登録"}</p>
                {participation ? (
                  <div className="mt-3 rounded-lg bg-[var(--mikke-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--mikke-accent-strong)]">
                    <p>Mikke ID受取済み</p>
                    <p className="mt-1 leading-5">
                      応援者: {supporterConsentLabels[participation.supporterConsentStatus]}
                      ・表示: {displayModeLabels[participation.displayMode]}
                      ・あなた: {ownerConsentLabels[participation.ownerConsentStatus]}
                    </p>
                  </div>
                ) : activeClaim ? (
                  <p className="mt-3 text-xs font-semibold text-[var(--mikke-muted)]">招待中・{formatInviteExpiry(activeClaim.expiresAt)}まで有効</p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {participation ? (
                    <>
                      <button type="button" disabled className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-muted)] opacity-60">受取済み</button>
                      <button
                        type="button"
                        onClick={() => changeOwnerConsent(
                          support,
                          participation.id,
                          participation.ownerConsentStatus === "granted" ? "revoked" : "granted"
                        )}
                        disabled={isChangingOwnerConsent}
                        className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-primary)] disabled:opacity-45"
                      >
                        {isChangingOwnerConsent
                          ? "変更中…"
                          : participation.ownerConsentStatus === "granted"
                            ? "Story公開を停止"
                            : "Story公開を許可"}
                      </button>
                    </>
                  ) : activeClaim ? (
                    <button type="button" onClick={() => revokeMikkeInvite(support, activeClaim.id)} disabled={isRevoking} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-danger)] disabled:opacity-45">
                      {isRevoking ? "取消中…" : "招待を取り消す"}
                    </button>
                  ) : (
                    <button type="button" onClick={() => issueMikkeInvite(support)} disabled={support.recordStatus !== "valid" || isIssuing} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-primary)] disabled:opacity-45">
                      {isIssuing ? "招待を作成中…" : "Mikke IDに招待"}
                    </button>
                  )}
                  {support.recordStatus !== "valid" ? <span className="text-xs text-[var(--mikke-muted)]">有効な応援記録のみ招待できます</span> : null}
                </div>
                {inviteError?.supportId === support.id ? <p className="mt-2 text-xs font-semibold text-[var(--mikke-danger)]">{inviteError.message}</p> : null}
                {inviteDraft?.supportId === support.id && activeClaim?.id === inviteDraft.claimId ? (
                  <div className="mt-3 rounded-lg bg-[var(--mikke-surface-soft)] p-3">
                    <p className="text-xs font-bold">応援者へ渡す招待URL（{formatInviteExpiry(inviteDraft.expiresAt)}まで有効）</p>
                    <div className="mt-2 flex gap-2">
                      <input readOnly value={inviteDraft.inviteUrl} className="min-w-0 flex-1 rounded border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-2 py-1.5 text-xs" />
                      <button type="button" onClick={() => navigator.clipboard.writeText(inviteDraft.inviteUrl)} className="rounded border border-[var(--mikke-line)] px-3 py-1.5 text-xs font-bold">コピー</button>
                    </div>
                  </div>
                ) : null}
                  </>;
                })()}
              </div>
            ))}
          </div>
        ) : <MikkeEmptyState title="応援者はまだ登録されていません" helper="外部申込を確認したら、ここへ手動登録します。" />}
      </MikkeSection>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold text-[var(--mikke-muted)]">{label}</p><p className="mt-1 text-lg font-bold">{value}</p></div>; }
const supporterConsentLabels: Record<FundSupportIdentityStatus["participation"] extends infer T ? T extends { supporterConsentStatus: infer S } ? S & string : never : never, string> = {
  pending: "まだ公開しない",
  granted: "公開を許可",
  revoked: "公開を取消済み"
};
const ownerConsentLabels: Record<FundParticipation["owner_consent_status"], string> = {
  pending: "確認待ち",
  granted: "Story公開を許可",
  revoked: "Story公開を停止"
};
const displayModeLabels: Record<FundParticipation["display_mode"], string> = {
  hidden: "非公開",
  public_name: "公開名",
  anonymous: "匿名"
};
function formatInviteExpiry(value: string) { return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(value)); }
const inputClass = "mt-1.5 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--mikke-accent)]";
const smallSelectClass = "mt-1.5 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-2 py-2 text-xs outline-none";
function Field({ label, required = false, className = "", children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) { return <label className={`block ${className}`}><span className="text-xs font-bold">{label}{required ? <span className="ml-1 text-[var(--mikke-accent)]">*</span> : null}</span>{children}</label>; }
