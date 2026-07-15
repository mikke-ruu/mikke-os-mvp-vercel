"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { FundPublicShell } from "@/components/fund/FundPublicShell";
import { acceptFundSupportClaim } from "@/lib/fund/identity";

function FundInviteContent() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "accepting" | "error">("idle");
  const [message, setMessage] = useState("");

  async function accept() {
    setStatus("accepting");
    setMessage("");
    try {
      const participationId = await acceptFundSupportClaim(params.token);
      router.replace(`/fund/me/${participationId}`);
    } catch {
      setStatus("error");
      setMessage("この招待は利用できません。期限切れ・取消済み・使用済みの可能性があります。");
    }
  }

  return (
    <FundPublicShell title="Fund">
      <div className="mx-auto max-w-xl">
        <p className="text-sm font-bold text-[var(--mikke-primary)]">応援の記録を受け取る</p>
        <h1 className="mt-2 text-3xl font-bold tracking-normal">あなたの応援として登録します</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--mikke-muted)]">
          Mikke IDで受け取ったあと、表示名と公開範囲はあなた自身で決められます。金額・メールアドレス・コメントは公開されません。
        </p>
        {message ? <p className="mt-5 rounded-lg bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--mikke-accent-strong)]">{message}</p> : null}
        <button type="button" onClick={accept} disabled={status === "accepting"} className="mt-7 w-full rounded-lg bg-[var(--mikke-primary)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
          {status === "accepting" ? "登録中…" : "応援の記録を受け取る"}
        </button>
      </div>
    </FundPublicShell>
  );
}

export default function FundInvitePage() {
  return <AuthGate><FundInviteContent /></AuthGate>;
}
