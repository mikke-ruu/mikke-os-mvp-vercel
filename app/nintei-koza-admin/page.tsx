"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NinteiKozaShell } from "@/components/nintei-koza/NinteiKozaShell";
import { INQUIRY_STATUS_LABELS, INQUIRY_TOPIC_LABELS, listInquiries, updateInquiryStatus } from "@/lib/nintei-koza/inquiries";
import type { NinteiKozaInquiry } from "@/types/database";

const STATUS_OPTIONS = ["new", "in_progress", "won", "lost", "closed"];

function InquiriesContent() {
  const [inquiries, setInquiries] = useState<NinteiKozaInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [referralFilter, setReferralFilter] = useState("");

  useEffect(() => {
    listInquiries()
      .then(setInquiries)
      .finally(() => setLoading(false));
  }, []);

  async function changeStatus(id: string, status: string) {
    const updated = await updateInquiryStatus(id, status);
    setInquiries((prev) => prev.map((i) => (i.id === id ? updated : i)));
  }

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;

  const referralCodes = Array.from(new Set(inquiries.map((i) => i.referral).filter(Boolean))) as string[];
  const filtered = referralFilter ? inquiries.filter((i) => i.referral === referralFilter) : inquiries;

  return (
    <div className="space-y-4">
      {referralCodes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[var(--mikke-muted)]">紹介コードで絞り込み:</span>
          <button
            onClick={() => setReferralFilter("")}
            className={`rounded-full px-3 py-1 text-xs font-bold ${!referralFilter ? "bg-[var(--mikke-accent)] text-white" : "bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]"}`}
          >
            すべて
          </button>
          {referralCodes.map((code) => (
            <button
              key={code}
              onClick={() => setReferralFilter(code)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${referralFilter === code ? "bg-[var(--mikke-accent)] text-white" : "bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]"}`}
            >
              {code}
            </button>
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-[var(--mikke-line)] bg-white p-6 text-center text-sm text-[var(--mikke-muted)]">
          問い合わせはまだありません。
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((inq) => (
            <li key={inq.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--mikke-text)]">
                    {inq.name} <span className="ml-1 text-xs font-normal text-[var(--mikke-muted)]">{inq.email}</span>
                  </p>
                  <p className="mt-1 text-xs text-[var(--mikke-muted)]">
                    {INQUIRY_TOPIC_LABELS[inq.topic] ?? inq.topic}
                    {inq.genre ? ` ／ ${inq.genre}` : ""}
                    {inq.referral ? (
                      <span className="ml-2 rounded-full bg-[var(--mikke-accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">
                        紹介: {inq.referral}
                      </span>
                    ) : null}
                  </p>
                  {inq.message ? <p className="mt-2 whitespace-pre-wrap text-xs text-[var(--mikke-text)]">{inq.message}</p> : null}
                  <p className="mt-2 text-[10px] text-[var(--mikke-muted-light)]">
                    {new Date(inq.created_at).toLocaleString("ja-JP")} ／ {inq.source || "-"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <select
                    value={inq.status}
                    onChange={(e) => changeStatus(inq.id, e.target.value)}
                    className="rounded-lg border border-[var(--mikke-line)] px-2 py-1 text-xs font-bold text-[var(--mikke-text)]"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {INQUIRY_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  {inq.status === "won" ? (
                    <Link
                      href={`/nintei-koza-admin/conversions?inquiryId=${inq.id}`}
                      className="flex items-center gap-1 text-[11px] font-bold text-[var(--mikke-accent)]"
                    >
                      成約登録へ <ArrowRight size={11} />
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function NinteiKozaInquiriesPage() {
  return (
    <NinteiKozaShell title="問い合わせ一覧">
      <InquiriesContent />
    </NinteiKozaShell>
  );
}
