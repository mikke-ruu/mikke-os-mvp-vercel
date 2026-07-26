"use client";

import { Copy, LinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";

/**
 * 名簿ページに置く「固定ポータルURL」カード。
 * 登録した相手にはこのURLだけを渡す。相手はここでログイン（または新規登録）すると、
 * メールアドレスが名簿と一致していれば自動でポータルが開通する。
 * プロジェクトごとの個別招待URLを毎回渡す運用を廃止するための入り口。
 */
export function TeamWorksPortalUrlCard({
  title,
  path,
  description
}: {
  title: string;
  path: string;
  description: string;
}) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const url = origin ? `${origin}${path}` : path;

  async function copy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <MikkeSection title={title} tone="editorial">
      <p className="-mt-2 text-xs leading-6 text-[var(--mikke-muted)]">{description}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-3 py-2.5">
          <LinkIcon size={15} className="shrink-0 text-[var(--mikke-primary)]" />
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--mikke-text)]">{url}</span>
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-4 py-2.5 text-xs font-bold text-white"
        >
          <Copy size={15} /> {copied ? "コピーしました" : "URLをコピー"}
        </button>
      </div>
    </MikkeSection>
  );
}
