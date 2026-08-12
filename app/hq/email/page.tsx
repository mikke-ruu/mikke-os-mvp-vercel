"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, Mail, Send, ShieldCheck, Users, X } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import {
  previewCampaignDelivery,
  sendCampaignTestEmail,
  sendCampaignToAudience,
  type CampaignDeliveryPreview
} from "@/lib/email-delivery";
import {
  createHqEmailCampaign,
  getHqEmailAudienceSummary,
  getHqStaffMembership,
  listHqEmailCampaigns,
  type HqEmailAudienceSummary,
  type HqEmailCampaign
} from "@/lib/hq";

const typeLabels: Record<HqEmailCampaign["campaign_type"], string> = {
  essential_notice: "重要なお知らせ",
  newsletter: "mikkeOS便り",
  product_update: "新機能・アップデート"
};

const audienceLabels: Record<HqEmailCampaign["audience_kind"], string> = {
  all_accounts: "全アカウント",
  newsletter_subscribers: "mikkeOS便りを希望した人",
  product_update_subscribers: "アップデート案内を希望した人"
};

const statusLabels: Record<HqEmailCampaign["status"], string> = {
  draft: "下書き",
  scheduled: "予約済み",
  sending: "配信未完了",
  sent: "配信済み",
  cancelled: "中止"
};

export default function HqEmailPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<HqEmailAudienceSummary | null>(null);
  const [campaigns, setCampaigns] = useState<HqEmailCampaign[]>([]);
  const [campaignType, setCampaignType] = useState<HqEmailCampaign["campaign_type"]>("newsletter");
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deliveryPreview, setDeliveryPreview] = useState<(CampaignDeliveryPreview & { campaignId: string }) | null>(null);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [testConfirmed, setTestConfirmed] = useState(false);
  const [canSendToAudience, setCanSendToAudience] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [nextSummary, nextCampaigns] = await Promise.all([
        getHqEmailAudienceSummary(),
        listHqEmailCampaigns()
      ]);
      const membership = await getHqStaffMembership(user.id);
      setSummary(nextSummary);
      setCampaigns(nextCampaigns);
      setCanSendToAudience(membership?.role === "owner" || membership?.role === "admin");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "メール配信設定を読み込めませんでした。");
    }
  }

  async function sendTest(campaign: HqEmailCampaign) {
    setTestingId(campaign.id);
    setMessage("");
    try {
      const result = await sendCampaignTestEmail(campaign.id);
      setMessage(`テストメールを ${result.recipient ?? "あなたの登録メール"} へ送りました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "テストメールを送信できませんでした。");
    } finally {
      setTestingId(null);
    }
  }

  async function prepareDelivery(campaign: HqEmailCampaign) {
    setPreparingId(campaign.id);
    setMessage("");
    setDeliveryPreview(null);
    setConfirmationInput("");
    setTestConfirmed(false);
    try {
      const preview = await previewCampaignDelivery(campaign.id);
      setDeliveryPreview({ ...preview, campaignId: campaign.id });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "配信対象を確認できませんでした。");
    } finally {
      setPreparingId(null);
    }
  }

  async function confirmDelivery() {
    if (!deliveryPreview) return;
    setSendingId(deliveryPreview.campaignId);
    setMessage("");
    try {
      const result = await sendCampaignToAudience({
        campaignId: deliveryPreview.campaignId,
        expectedRecipientCount: deliveryPreview.recipient_count,
        confirmationText: confirmationInput
      });
      if (result.completed) {
        setMessage(`${result.sent_count.toLocaleString()}人への配信を受け付けました。配信済みとして記録しました。`);
        setDeliveryPreview(null);
        setConfirmationInput("");
        setTestConfirmed(false);
      } else {
        setMessage(`${result.sent_count.toLocaleString()}人へ送信済み、${result.failed_count.toLocaleString()}人は未完了です。原因を確認してから再開できます。`);
      }
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "利用者への配信を実行できませんでした。");
      await load();
    } finally {
      setSendingId(null);
    }
  }

  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await createHqEmailCampaign({
        campaign_type: campaignType,
        subject: subject.trim(),
        preview_text: previewText.trim(),
        body_text: bodyText.trim()
      });
      setSubject("");
      setPreviewText("");
      setBodyText("");
      setMessage("配信原稿を下書き保存しました。まだ送信されていません。");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "下書きを保存できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-bold tracking-[0.15em] text-[var(--mikke-primary)]">EMAIL</p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--mikke-text)]">メール配信</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">受信を希望した人へ届ける原稿と、重要なお知らせを分けて管理します。</p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["全アカウント", summary?.all_accounts ?? 0],
          ["mikkeOS便り", summary?.newsletter_subscribers ?? 0],
          ["アップデート", summary?.product_update_subscribers ?? 0],
          ["下書き", summary?.campaign_drafts ?? 0]
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
            <Users size={17} className="text-[var(--mikke-primary)]" />
            <p className="mt-2 text-xs font-bold text-[var(--mikke-muted)]">{label}</p>
            <p className="mt-1 text-2xl font-bold text-[var(--mikke-text)]">{Number(value).toLocaleString()}<span className="ml-1 text-xs">人</span></p>
          </article>
        ))}
      </section>

      <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800">
        <ShieldCheck size={17} className="mt-0.5 shrink-0" />
        まず自分宛てのテストメールで文章を確認します。本配信は、対象人数の再確認・確認文の入力・チェックの3段階がそろうまで実行されません。
      </div>
      {message ? <p className="rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--mikke-muted)]" aria-live="polite">{message}</p> : null}

      <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm md:p-5">
        <div className="flex items-center gap-2"><Mail size={18} className="text-[var(--mikke-primary)]" /><h2 className="font-bold text-[var(--mikke-text)]">新しい配信原稿</h2></div>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <label className="block"><span className="text-sm font-bold">種類と送信対象</span><select value={campaignType} onChange={(event) => setCampaignType(event.target.value as HqEmailCampaign["campaign_type"])} className="mt-2 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-3 text-sm">
            <option value="newsletter">mikkeOS便り ― 希望した人だけ</option>
            <option value="product_update">新機能・アップデート ― 希望した人だけ</option>
            <option value="essential_notice">重要なお知らせ ― 全アカウント</option>
          </select></label>
          {campaignType === "essential_notice" ? <p className="rounded-xl bg-red-50 px-3 py-3 text-xs font-semibold leading-5 text-red-700">障害・安全・利用継続に関わる案内だけに使用します。宣伝には使用しません。</p> : null}
          <label className="block"><span className="text-sm font-bold">件名</span><input value={subject} onChange={(event) => setSubject(event.target.value)} required maxLength={160} className="mt-2 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-3 text-sm" /></label>
          <label className="block"><span className="text-sm font-bold">受信箱に表示する短い説明</span><input value={previewText} onChange={(event) => setPreviewText(event.target.value)} maxLength={200} className="mt-2 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-3 text-sm" /></label>
          <label className="block"><span className="text-sm font-bold">本文</span><textarea value={bodyText} onChange={(event) => setBodyText(event.target.value)} required rows={8} className="mt-2 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-3 text-sm leading-6" /></label>
          <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--mikke-primary)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"><Send size={17} />{saving ? "保存中…" : "下書き保存（送信しない）"}</button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 font-bold text-[var(--mikke-text)]">保存した原稿</h2>
        <div className="space-y-3">
          {campaigns.length === 0 ? <p className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5 text-sm text-[var(--mikke-muted)]">まだ原稿はありません。</p> : campaigns.map((campaign) => (
            <article key={campaign.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold"><span className="rounded-full bg-[var(--mikke-primary-soft)] px-2 py-1 text-[var(--mikke-primary)]">{typeLabels[campaign.campaign_type]}</span><span className="text-[var(--mikke-muted)]">{audienceLabels[campaign.audience_kind]}</span><span className="ml-auto text-[var(--mikke-muted)]">{statusLabels[campaign.status]}</span></div>
              <h3 className="mt-3 font-bold text-[var(--mikke-text)]">{campaign.subject}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--mikke-muted)]">{campaign.preview_text || campaign.body_text.slice(0, 100)}</p>
              {campaign.status === "draft" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void sendTest(campaign)} disabled={testingId !== null || preparingId !== null || sendingId !== null} className="inline-flex items-center gap-2 rounded-xl border border-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-[var(--mikke-primary)] disabled:opacity-50"><Send size={15} />{testingId === campaign.id ? "送信中…" : "自分にテスト送信"}</button>
                  {canSendToAudience ? <button type="button" onClick={() => void prepareDelivery(campaign)} disabled={testingId !== null || preparingId !== null || sendingId !== null} className="inline-flex items-center gap-2 rounded-xl bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><ShieldCheck size={15} />{preparingId === campaign.id ? "人数を確認中…" : "配信前の最終確認"}</button> : null}
                </div>
              ) : campaign.status === "sending" && canSendToAudience ? (
                <button type="button" onClick={() => void prepareDelivery(campaign)} disabled={preparingId !== null || sendingId !== null} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-500 px-3 py-2 text-xs font-bold text-amber-700 disabled:opacity-50"><AlertTriangle size={15} />{preparingId === campaign.id ? "人数を再確認中…" : "未完了の配信を確認・再開"}</button>
              ) : campaign.status === "sent" ? (
                <p className="mt-3 text-xs font-bold text-emerald-700">{campaign.recipient_count.toLocaleString()}人へ配信済み</p>
              ) : null}

              {deliveryPreview?.campaignId === campaign.id ? (
                <div className="mt-4 rounded-2xl border-2 border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-600" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-red-800">利用者へ実際に配信する最終確認</p>
                          <p className="mt-1 text-xs leading-5 text-red-700">現在の送信対象は <strong className="text-base">{deliveryPreview.recipient_count.toLocaleString()}人</strong> です。送信直前にもサーバーで再計算します。</p>
                        </div>
                        <button type="button" onClick={() => setDeliveryPreview(null)} disabled={sendingId !== null} aria-label="最終確認を閉じる" className="rounded-full p-1 text-red-700 hover:bg-red-100 disabled:opacity-50"><X size={18} /></button>
                      </div>

                      {!deliveryPreview.test_ready ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-bold leading-5 text-amber-800">現在の件名・本文では、テスト送信の記録がありません。いったん閉じて「自分にテスト送信」を実行してください。</p> : null}

                      <label className="mt-4 flex items-start gap-2 rounded-xl bg-white px-3 py-3 text-xs font-semibold leading-5 text-[var(--mikke-text)]">
                        <input type="checkbox" checked={testConfirmed} onChange={(event) => setTestConfirmed(event.target.checked)} disabled={sendingId !== null} className="mt-1" />
                        自分宛てのテストメールを開き、件名と本文を確認しました
                      </label>
                      <label className="mt-3 block">
                        <span className="text-xs font-bold text-red-800">確認のため、次の文字をそのまま入力してください</span>
                        <code className="mt-1 block rounded-lg bg-white px-3 py-2 text-sm font-bold text-red-800">{deliveryPreview.confirmation_text}</code>
                        <input value={confirmationInput} onChange={(event) => setConfirmationInput(event.target.value)} disabled={sendingId !== null} autoComplete="off" className="mt-2 w-full rounded-xl border border-red-300 bg-white px-3 py-3 text-sm" />
                      </label>
                      <button type="button" onClick={() => void confirmDelivery()} disabled={sendingId !== null || !deliveryPreview.test_ready || deliveryPreview.recipient_count === 0 || !testConfirmed || confirmationInput !== deliveryPreview.confirmation_text} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Send size={17} />{sendingId === campaign.id ? "利用者へ配信中…画面を閉じないでください" : `${deliveryPreview.recipient_count.toLocaleString()}人へ本配信する`}</button>
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
