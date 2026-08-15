"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { KoushiShell } from "@/components/academy/AcademyShell";
import {
  CLASS_INSTRUCTOR_REQUEST_STATUS_LABELS,
  listMyClassInstructorRequests,
  respondClassInstructorRequest
} from "@/lib/academy/class-instructor-requests";
import type { AcademyClassInstructorRequest } from "@/types/database";

function formatDateTime(value: string | null) {
  if (!value) return "未設定";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function ClassRequestsContent() {
  const [requests, setRequests] = useState<AcademyClassInstructorRequest[]>([]);
  const [noteByRequest, setNoteByRequest] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await listMyClassInstructorRequests());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "担当依頼を読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function respond(requestId: string, status: "accepted" | "declined") {
    setBusyId(requestId);
    setMessage("");
    try {
      await respondClassInstructorRequest(requestId, status, noteByRequest[requestId] ?? "");
      setMessage(status === "accepted" ? "担当依頼を承諾しました。" : "担当依頼を辞退しました。");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "担当依頼へ回答できませんでした。");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]">
            <CalendarCheck size={19} />
          </span>
          <div>
            <h2 className="text-base font-bold text-[var(--mikke-text)]">クラス担当の依頼</h2>
            <p className="mt-1 text-sm text-[var(--mikke-muted)]">本部から届いた依頼を確認し、承諾または辞退できます。</p>
          </div>
        </div>
        {message ? <p className="mt-4 text-sm font-bold text-[var(--mikke-accent-strong)]">{message}</p> : null}
      </section>

      {loading ? (
        <p className="py-12 text-center text-sm text-[var(--mikke-muted)]">担当依頼を確認しています…</p>
      ) : requests.length ? (
        requests.map((request) => (
          <section key={request.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[var(--mikke-accent-strong)]">
                  {request.class?.course?.code} {request.class?.course?.name}
                </p>
                <h3 className="mt-1 text-base font-bold text-[var(--mikke-text)]">{request.class?.title ?? "クラス"}</h3>
                <p className="mt-2 text-sm text-[var(--mikke-muted)]">
                  {formatDateTime(request.class?.starts_at ?? null)}
                  {request.class?.ends_at ? ` 〜 ${formatDateTime(request.class.ends_at)}` : ""}
                </p>
                <p className="mt-1 text-xs text-[var(--mikke-muted)]">
                  {request.class?.format === "online" ? "オンライン" : "対面"}
                  {request.class?.venue_name ? ` ・ ${request.class.venue_name}` : ""}
                </p>
              </div>
              <span className="rounded-full bg-[var(--mikke-surface-soft)] px-3 py-1 text-xs font-bold text-[var(--mikke-text-soft)]">
                {CLASS_INSTRUCTOR_REQUEST_STATUS_LABELS[request.status]}
              </span>
            </div>

            <div className="mt-4 rounded-xl bg-[var(--mikke-surface-soft)] p-3 text-sm text-[var(--mikke-text-soft)]">
              <p>{request.request_note || "依頼メモはありません。"}</p>
              {request.respond_by ? <p className="mt-1 text-xs text-[var(--mikke-muted)]">回答期限: {formatDateTime(request.respond_by)}</p> : null}
            </div>

            {request.status === "requested" ? (
              <div className="mt-4 space-y-2">
                <textarea
                  value={noteByRequest[request.id] ?? ""}
                  onChange={(event) =>
                    setNoteByRequest((current) => ({ ...current, [request.id]: event.target.value }))
                  }
                  placeholder="本部への回答メモ（任意）"
                  rows={3}
                  className="w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busyId === request.id}
                    onClick={() => void respond(request.id, "declined")}
                    className="rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-2 text-sm font-bold text-[var(--mikke-text-soft)] disabled:opacity-50"
                  >
                    辞退する
                  </button>
                  <button
                    type="button"
                    disabled={busyId === request.id}
                    onClick={() => void respond(request.id, "accepted")}
                    className="rounded-xl bg-[var(--mikke-primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    承諾する
                  </button>
                </div>
              </div>
            ) : request.response_note ? (
              <p className="mt-4 text-sm text-[var(--mikke-text-soft)]">回答メモ: {request.response_note}</p>
            ) : null}
          </section>
        ))
      ) : (
        <p className="rounded-2xl border border-[var(--mikke-line)] bg-white p-6 text-sm text-[var(--mikke-muted)]">
          現在、クラス担当の依頼はありません。
        </p>
      )}
    </div>
  );
}

export default function AcademyClassRequestsPage() {
  return (
    <KoushiShell title="クラス担当依頼">
      <ClassRequestsContent />
    </KoushiShell>
  );
}
