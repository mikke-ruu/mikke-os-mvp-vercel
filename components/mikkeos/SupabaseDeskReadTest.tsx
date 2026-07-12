"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ListChecks, RefreshCw } from "lucide-react";
import { formatYen } from "@/lib/format";
import { isDeskCountedLog } from "@/lib/mikkeos/activity-log-filters";
import { supabase } from "@/lib/supabase/client";

type SupabaseDeskReadRow = {
  id: string;
  title: string;
  source_service: string;
  category: string;
  visibility: "public" | "private" | "limited";
  display_on_story: boolean;
  counts_toward_summary: boolean;
  has_financial_value: boolean;
  amount: number | null;
  transaction_type: "revenue" | "expense" | "none";
  payment_status: "unpaid" | "paid" | "not_required";
  occurred_at: string;
  created_at: string;
};

type ReadState =
  | { status: "loading"; message: string; rows: SupabaseDeskReadRow[] }
  | { status: "success"; message: string; rows: SupabaseDeskReadRow[] }
  | { status: "empty"; message: string; rows: SupabaseDeskReadRow[] }
  | { status: "error"; message: string; rows: SupabaseDeskReadRow[] };

const deskReadSelect =
  "id,title,source_service,category,visibility,display_on_story,counts_toward_summary,has_financial_value,amount,transaction_type,payment_status,occurred_at,created_at";

export function SupabaseDeskReadTest() {
  const [state, setState] = useState<ReadState>({
    status: "loading",
    message: "Supabase DESK読み取りテストを確認しています。",
    rows: []
  });

  const readDeskLogs = useCallback(async () => {
    setState({ status: "loading", message: "SupabaseからDESK対象ログを読み取っています。", rows: [] });

    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError) {
      setState({ status: "error", message: sessionError.message, rows: [] });
      return;
    }

    if (!session?.user) {
      setState({ status: "error", message: "Supabase desk read test needs a logged-in user.", rows: [] });
      return;
    }

    const { data, error } = await supabase
      .from("activity_logs")
      .select(deskReadSelect)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      setState({ status: "error", message: error.message, rows: [] });
      return;
    }

    const rows = (data ?? []) as SupabaseDeskReadRow[];
    const deskRows = rows.filter(isDeskCountedLog);
    setState({
      status: deskRows.length > 0 ? "success" : "empty",
      message:
        deskRows.length > 0 ? `${deskRows.length}件のDESK対象ログを読み取りました。` : "DESK対象ログはまだ見つかりません。",
      rows
    });
  }, []);

  useEffect(() => {
    void readDeskLogs();
  }, [readDeskLogs]);

  const deskRows = state.rows.filter(isDeskCountedLog);
  const hiddenRows = state.rows.length - deskRows.length;
  const summary = useMemo(() => getDeskReadSummary(deskRows), [deskRows]);

  return (
    <section className="mt-6 rounded-2xl border border-dashed border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-full bg-white p-2 text-[var(--mikke-accent)]">
            <ListChecks size={18} />
          </span>
          <div>
            <h2 className="text-sm font-bold tracking-normal text-[var(--mikke-text)]">Supabase DESK読み取りテスト</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">
              通常のDESK表示はそのまま、Supabaseから読み取ったログをDESK対象条件だけで確認します。
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void readDeskLogs()}
          disabled={state.status === "loading"}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-text-soft)] disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw size={14} />
          再読込
        </button>
      </div>

      <p className={`mt-3 text-xs font-bold ${state.status === "error" ? "text-[var(--mikke-danger)]" : "text-[var(--mikke-success)]"}`}>
        {state.message}
      </p>

      {state.rows.length > 0 ? (
        <div className="mt-4 border-t border-[var(--mikke-line-soft)] pt-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <DeskMetric label="DESK対象" value={`${deskRows.length}件`} />
            <DeskMetric label="DESK非対象" value={`${hiddenRows}件`} muted />
            <DeskMetric label="売上合計" value={formatYen(summary.revenue)} />
            <DeskMetric label="経費合計" value={formatYen(summary.expense)} />
            <DeskMetric label="差引" value={formatYen(summary.net)} />
          </div>

          {deskRows.length > 0 ? (
            <div className="mt-3 grid gap-3">
              {deskRows.map((row) => (
                <SupabaseDeskReadCard key={row.id} row={row} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs font-bold text-[var(--mikke-muted-light)]">DESK対象ログはありません。</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function getDeskReadSummary(rows: SupabaseDeskReadRow[]) {
  return rows.reduce(
    (summary, row) => {
      const amount = row.amount ?? 0;
      if (row.transaction_type === "revenue") {
        return { ...summary, revenue: summary.revenue + amount, net: summary.net + amount };
      }
      if (row.transaction_type === "expense") {
        return { ...summary, expense: summary.expense + amount, net: summary.net - amount };
      }
      return summary;
    },
    { revenue: 0, expense: 0, net: 0 }
  );
}

function DeskMetric({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`rounded-2xl border border-[var(--mikke-line)] bg-white p-3 text-center ${muted ? "opacity-75" : ""}`}>
      <p className="text-[11px] font-bold text-[var(--mikke-muted-light)]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[var(--mikke-text)]">{value}</p>
    </div>
  );
}

function SupabaseDeskReadCard({ row }: { row: SupabaseDeskReadRow }) {
  return (
    <article className="rounded-2xl border border-[var(--mikke-line)] bg-white p-3 text-xs text-[var(--mikke-text-soft)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-bold text-[var(--mikke-text)]">{row.title}</h3>
        <p className={`shrink-0 font-bold ${row.transaction_type === "expense" ? "text-[var(--mikke-primary)]" : "text-[var(--mikke-success)]"}`}>
          {row.transaction_type === "expense" ? "-" : "+"}
          {formatYen(row.amount ?? 0)}
        </p>
      </div>
      <dl className="mt-2 grid gap-1.5">
        <ReadLine label="source_service" value={row.source_service} />
        <ReadLine label="category" value={row.category} />
        <ReadLine label="amount" value={row.amount === null ? "null" : String(row.amount)} />
        <ReadLine label="transaction_type" value={row.transaction_type} />
        <ReadLine label="payment_status" value={row.payment_status} />
        <ReadLine label="visibility" value={row.visibility} />
        <ReadLine label="display_on_story" value={String(row.display_on_story)} />
        <ReadLine label="counts_toward_summary" value={String(row.counts_toward_summary)} />
        <ReadLine label="has_financial_value" value={String(row.has_financial_value)} />
        <ReadLine label="occurred_at" value={formatDateTime(row.occurred_at)} />
        <ReadLine label="created_at" value={formatDateTime(row.created_at)} />
      </dl>
    </article>
  );
}

function ReadLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-2">
      <dt className="font-bold text-[var(--mikke-muted-light)]">{label}</dt>
      <dd className="break-words text-[var(--mikke-text)]">{value}</dd>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
