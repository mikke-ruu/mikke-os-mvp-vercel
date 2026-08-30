"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GraduationCap, Store } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { listMyAcademyContexts, toAcademyContextHref } from "@/lib/academy/access-context";
import type { AcademyAccessContext } from "@/types/database";

const ROLE_LABELS = {
  owner: "オーナー",
  administrator: "本部スタッフ",
  course_editor: "講座編集",
  instructor: "認定講師",
  learner: "受講者"
} as const;

function AcademySelector() {
  const [contexts, setContexts] = useState<AcademyAccessContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    listMyAcademyContexts()
      .then(setContexts)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">Academyを確認中…</p>;

  if (loadError) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-6">
          <p className="text-sm font-bold text-[var(--mikke-text)]">Academyの所属を確認できませんでした</p>
          <p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]">通信状態を確認して、画面を読み込み直してください。</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-[var(--mikke-accent)] px-4 py-2 text-xs font-bold text-white">
            もう一度読み込む
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-10">
      <div>
        <p className="text-xs font-bold text-[var(--mikke-accent)]">Academy</p>
        <h1 className="mt-1 text-xl font-bold text-[var(--mikke-text)]">利用できるAcademyと画面を確認</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">
          Academyごとの役割を確認します。表示の切替だけでは権限は増えません。
        </p>
      </div>

      {contexts.length === 0 ? (
        <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-6 text-center">
          <p className="text-sm font-bold text-[var(--mikke-text)]">利用できるAcademyはありません</p>
          <p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]">
            受講の確定、本部契約、スタッフ招待、または認定講師登録が完了すると、ここに表示されます。
          </p>
        </div>
      ) : (
        <ul className="grid gap-4">
          {contexts.map((context) => (
            <li key={context.academy_id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-[var(--mikke-text)]">{context.academy_name}</h2>
                  <p className="mt-1 text-xs text-[var(--mikke-muted)]">
                    {context.roles.map((role) => ROLE_LABELS[role]).join("・")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {context.portals.includes("manage") ? (
                    <Link href={toAcademyContextHref("/academy", context.academy_id, "manage")} className="inline-flex items-center gap-1 rounded-xl bg-[var(--mikke-accent)] px-3 py-2 text-xs font-bold text-white">
                      <Store size={14} /> 本部画面
                    </Link>
                  ) : null}
                  {context.portals.includes("teach") ? (
                    <Link href={toAcademyContextHref("/academy/portal", context.academy_id, "teach")} className="inline-flex items-center gap-1 rounded-xl border border-[var(--mikke-accent)] px-3 py-2 text-xs font-bold text-[var(--mikke-accent-strong)]">
                      <GraduationCap size={14} /> マイポータル
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default function AcademySelectPage() {
  return (
    <AuthGate>
      <AcademySelector />
    </AuthGate>
  );
}
