"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { claimMyApplication } from "@/lib/academy/graduate";

function ClaimContent({ applicationId }: { applicationId: string }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<"loading" | "claimed" | "error">("loading");

  useEffect(() => {
    let active = true;
    claimMyApplication(applicationId)
      .then(() => {
        if (active) setStatus("claimed");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [applicationId, user.id]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--mikke-surface-soft)] px-5 py-10">
      <section className="w-full max-w-md rounded-2xl border border-[var(--mikke-line)] bg-white p-6 text-center">
        {status === "loading" ? (
          <p className="text-sm font-bold text-[var(--mikke-text)]">受講情報を確認しています…</p>
        ) : status === "claimed" ? (
          <>
            <h1 className="text-lg font-bold text-[var(--mikke-text)]">マイポータルにつなぎました</h1>
            <p className="mt-2 text-xs leading-6 text-[var(--mikke-muted)]">
              入金確認後、受講中の講座、復習ページ、閲覧期限がこのアカウントに表示されます。
            </p>
            <Link href="/academy/select" className="mt-5 inline-flex rounded-xl bg-[var(--mikke-accent)] px-4 py-2 text-sm font-bold text-white">
              Academyを開く
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold text-[var(--mikke-text)]">受講情報をつなげられませんでした</h1>
            <p className="mt-2 text-xs leading-6 text-[var(--mikke-muted)]">
              現在は {user.email ?? "メール未設定"} でログイン中です。申込時と同じ、確認済みのメールアドレスでログインしてください。
            </p>
          </>
        )}
      </section>
    </main>
  );
}

export default function AcademyClaimPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = use(params);
  return (
    <AuthGate>
      <ClaimContent applicationId={applicationId} />
    </AuthGate>
  );
}
