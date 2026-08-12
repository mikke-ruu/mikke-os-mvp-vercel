"use client";

import { useEffect, useState } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import { getEmailPreferences, saveEmailPreferences } from "@/lib/email-preferences";

export function EmailPreferencesCard({ userId }: { userId: string }) {
  const [newsletter, setNewsletter] = useState(false);
  const [productUpdates, setProductUpdates] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    getEmailPreferences(userId)
      .then((preferences) => {
        if (cancelled || !preferences) return;
        setNewsletter(preferences.newsletter_enabled);
        setProductUpdates(preferences.product_updates_enabled);
      })
      .catch(() => {
        if (!cancelled) setMessage("メール設定を読み込めませんでした。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      await saveEmailPreferences(userId, {
        newsletter_enabled: newsletter,
        product_updates_enabled: productUpdates
      });
      setMessage("メール設定を保存しました。");
    } catch {
      setMessage("保存できませんでした。時間をおいてもう一度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--mikke-primary-soft)] text-[var(--mikke-primary)]"><Mail size={19} /></span>
        <div>
          <h2 className="text-sm font-bold text-[var(--mikke-text)]">メールで受け取る内容</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">必要なものだけ選べます。いつでも変更できます。</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--mikke-line)] p-3">
          <input type="checkbox" checked={newsletter} disabled={loading || saving} onChange={(event) => setNewsletter(event.target.checked)} className="mt-1 h-5 w-5 accent-[var(--mikke-primary)]" />
          <span><span className="block text-sm font-bold text-[var(--mikke-text)]">mikkeOS便り・活用ヒント</span><span className="mt-1 block text-xs leading-5 text-[var(--mikke-muted)]">使い方、事例、イベントなどのお便りです。</span></span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--mikke-line)] p-3">
          <input type="checkbox" checked={productUpdates} disabled={loading || saving} onChange={(event) => setProductUpdates(event.target.checked)} className="mt-1 h-5 w-5 accent-[var(--mikke-primary)]" />
          <span><span className="block text-sm font-bold text-[var(--mikke-text)]">新機能・アップデート</span><span className="mt-1 block text-xs leading-5 text-[var(--mikke-muted)]">新しいアプリや便利になった点をご案内します。</span></span>
        </label>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--mikke-surface-soft)] px-3 py-3 text-xs leading-5 text-[var(--mikke-muted)]">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        登録確認・安全に関する重要なお知らせは、この設定にかかわらず送る場合があります。
      </div>

      {message ? <p className="mt-3 text-xs font-semibold text-[var(--mikke-muted)]" aria-live="polite">{message}</p> : null}
      <button type="button" onClick={() => void save()} disabled={loading || saving} className="mt-4 w-full rounded-xl bg-[var(--mikke-primary)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
        {saving ? "保存中…" : "メール設定を保存"}
      </button>
    </section>
  );
}
