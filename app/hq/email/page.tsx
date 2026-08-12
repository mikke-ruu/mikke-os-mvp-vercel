"use client";

import { FormEvent, useEffect, useState } from "react";
import { Mail, Send, ShieldAlert, Users } from "lucide-react";
import {
  createHqEmailCampaign,
  getHqEmailAudienceSummary,
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

export default function HqEmailPage() {
  const [summary, setSummary] = useState<HqEmailAudienceSummary | null>(null);
  const [campaigns, setCampaigns] = useState<HqEmailCampaign[]>([]);
  const [campaignType, setCampaignType] = useState<HqEmailCampaign["campaign_type"]>("newsletter");
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [nextSummary, nextCampaigns] = await Promise.all([
        getHqEmailAudienceSummary(),
        listHqEmailCampaigns()
      ]);
      setSummary(nextSummary);
      setCampaigns(nextCampaigns);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "メール配信設定を読み込めませんでした。");
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

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
        <ShieldAlert size={17} className="mt-0.5 shrink-0" />
        現在は安全のため「下書き保存」までです。Resendの配信用キーを接続するまで、メールが送信されることはありません。
      </div>

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
        {message ? <p className="mt-3 text-sm font-semibold text-[var(--mikke-muted)]" aria-live="polite">{message}</p> : null}
      </section>

      <section>
        <h2 className="mb-3 font-bold text-[var(--mikke-text)]">保存した原稿</h2>
        <div className="space-y-3">
          {campaigns.length === 0 ? <p className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5 text-sm text-[var(--mikke-muted)]">まだ原稿はありません。</p> : campaigns.map((campaign) => (
            <article key={campaign.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold"><span className="rounded-full bg-[var(--mikke-primary-soft)] px-2 py-1 text-[var(--mikke-primary)]">{typeLabels[campaign.campaign_type]}</span><span className="text-[var(--mikke-muted)]">{audienceLabels[campaign.audience_kind]}</span><span className="ml-auto text-[var(--mikke-muted)]">{campaign.status === "draft" ? "下書き" : campaign.status}</span></div>
              <h3 className="mt-3 font-bold text-[var(--mikke-text)]">{campaign.subject}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--mikke-muted)]">{campaign.preview_text || campaign.body_text.slice(0, 100)}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
