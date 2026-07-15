"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { FundPublicShell } from "@/components/fund/FundPublicShell";
import { getMyFundParticipation, updateMyFundParticipationConsent, type FundParticipation } from "@/lib/fund/identity";

function FundParticipationContent() {
  const params = useParams<{ participationId: string }>();
  const [item, setItem] = useState<FundParticipation | null>(null);
  const [publicName, setPublicName] = useState("");
  const [displayMode, setDisplayMode] = useState<FundParticipation["display_mode"]>("hidden");
  const [consent, setConsent] = useState<FundParticipation["supporter_consent_status"]>("pending");
  const [message, setMessage] = useState("");

  useEffect(() => {
    getMyFundParticipation(params.participationId).then((next) => {
      setItem(next);
      if (next) {
        setPublicName(next.public_name ?? "");
        setDisplayMode(next.display_mode);
        setConsent(next.supporter_consent_status);
      }
    }).catch(() => setMessage("この応援の記録を読み込めませんでした。"));
  }, [params.participationId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) return;
    setMessage("");
    try {
      await updateMyFundParticipationConsent({ participationId: item.id, supporterConsentStatus: consent, publicName, displayMode });
      setMessage("公開設定を保存しました。");
    } catch {
      setMessage("公開設定を保存できませんでした。もう一度お試しください。");
    }
  }

  if (!item) {
    return <FundPublicShell title="あなたのFund"><p className="text-sm text-[var(--mikke-muted)]">応援の記録を確認しています。</p></FundPublicShell>;
  }

  return (
    <FundPublicShell title="あなたのFund" backHref="/fund/me">
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-bold tracking-normal">公開の設定</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--mikke-muted)]">あなたと実行者の両方が許可した場合だけ、Fundの公開欄に表示されます。</p>
        <form onSubmit={save} className="mt-7 grid gap-5">
          <label className="block text-sm font-bold">公開への同意
            <select value={consent} onChange={(event) => setConsent(event.target.value as FundParticipation["supporter_consent_status"])} className={inputClass}>
              <option value="pending">まだ公開しない</option>
              <option value="granted">公開を許可する</option>
              <option value="revoked">公開を取り消す</option>
            </select>
          </label>
          <label className="block text-sm font-bold">表示方法
            <select value={displayMode} onChange={(event) => setDisplayMode(event.target.value as FundParticipation["display_mode"])} className={inputClass}>
              <option value="hidden">表示しない</option>
              <option value="public_name">名前を表示する</option>
              <option value="anonymous">匿名で表示する</option>
            </select>
          </label>
          <label className="block text-sm font-bold">公開名
            <input value={publicName} onChange={(event) => setPublicName(event.target.value)} maxLength={80} className={inputClass} placeholder="表示したい名前" />
          </label>
          {message ? <p className="rounded-lg bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--mikke-accent-strong)]">{message}</p> : null}
          <button type="submit" className="rounded-lg bg-[var(--mikke-primary)] px-4 py-3 text-sm font-bold text-white">保存する</button>
        </form>
      </div>
    </FundPublicShell>
  );
}

const inputClass = "mt-2 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--mikke-accent)]";

export default function FundParticipationPage() {
  return <AuthGate><FundParticipationContent /></AuthGate>;
}
