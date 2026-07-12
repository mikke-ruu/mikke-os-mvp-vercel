"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, RefreshCw } from "lucide-react";
import { formatYen } from "@/lib/format";
import {
  isDeskCountedLog,
  isStoryVisibleLog,
  isSummaryCountedLog,
  splitActivityLogsByDestination
} from "@/lib/mikkeos/activity-log-filters";
import { supabase } from "@/lib/supabase/client";

type SupabaseOsSummaryRow = {
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
  | { status: "loading"; message: string; rows: SupabaseOsSummaryRow[]; totalCount: number | null }
  | { status: "success"; message: string; rows: SupabaseOsSummaryRow[]; totalCount: number | null }
  | { status: "empty"; message: string; rows: SupabaseOsSummaryRow[]; totalCount: number | null }
  | { status: "error"; message: string; rows: SupabaseOsSummaryRow[]; totalCount: number | null };

const osSummarySelect =
  "id,title,source_service,category,visibility,display_on_story,counts_toward_summary,has_financial_value,amount,transaction_type,payment_status,occurred_at,created_at";

export function SupabaseOsSummaryTest() {
  const [state, setState] = useState<ReadState>({
    status: "loading",
    message: "Supabase OSサマリーテストを確認しています。",
    rows: [],
    totalCount: null
  });

  const readSummaryLogs = useCallback(async () => {
    setState({
      status: "loading",
      message: "SupabaseからOSサマリー用Activity Logを読み取っています。",
      rows: [],
      totalCount: null
    });

    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError) {
      setState({ status: "error", message: sessionError.message, rows: [], totalCount: null });
      return;
    }

    if (!session?.user) {
      setState({
        status: "error",
        message: "Supabase OS summary test needs a logged-in user.",
        rows: [],
        totalCount: null
      });
      return;
    }

    const { data, error, count } = await supabase
      .from("activity_logs")
      .select(osSummarySelect, { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setState({ status: "error", message: error.message, rows: [], totalCount: null });
      return;
    }

    const rows = (data ?? []) as SupabaseOsSummaryRow[];
    setState({
      status: rows.length > 0 ? "success" : "empty",
      message: rows.length > 0 ? `${rows.length}件のActivity LogからOSサマリーを作成しました。` : "Activity Logはまだ見つかりません。",
      rows,
      totalCount: count
    });
  }, []);

  useEffect(() => {
    void readSummaryLogs();
  }, [readSummaryLogs]);

  const { storyLogs, deskLogs, summaryLogs } = splitActivityLogsByDestination(state.rows);
  const moneySummary = useMemo(() => getMoneySummary(deskLogs), [deskLogs]);
  const recentLogs = state.rows.slice(0, 5);

  return (
    <section className="mt-6 rounded-2xl border border-dashed border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-full bg-white p-2 text-[var(--mikke-accent)]">
            <Database size={18} />
          </span>
          <div>
            <h2 className="text-sm font-bold tracking-normal text-[var(--mikke-text)]">Supabase OSサマリーテスト</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">
              通常のOS Home表示はそのまま、SupabaseのActivity Logからサマリーを作れるか確認します。
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void readSummaryLogs()}
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
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <OsMetric label="Supabase総ログ数" value={`${state.totalCount ?? state.rows.length}件`} />
            <OsMetric label="Story対象" value={`${storyLogs.length}件`} />
            <OsMetric label="DESK対象" value={`${deskLogs.length}件`} />
            <OsMetric label="活動実績対象" value={`${summaryLogs.length}件`} />
            <OsMetric label="売上合計" value={formatYen(moneySummary.revenue)} />
            <OsMetric label="経費合計" value={formatYen(moneySummary.expense)} />
            <OsMetric label="差引" value={formatYen(moneySummary.net)} />
          </div>

          <div className="mt-4">
            <h3 className="text-xs font-bold text-[var(--mikke-text)]">最近のActivity Log 5件</h3>
            <div className="mt-2 grid gap-3">
              {recentLogs.map((row) => (
                <SupabaseOsRecentLog key={row.id} row={row} />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function getMoneySummary(rows: SupabaseOsSummaryRow[]) {
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

function OsMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-3 text-center">
      <p className="text-[11px] font-bold text-[var(--mikke-muted-light)]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[var(--mikke-text)]">{value}</p>
    </div>
  );
}

function SupabaseOsRecentLog({ row }: { row: SupabaseOsSummaryRow }) {
  return (
    <article className="rounded-2xl border border-[var(--mikke-line)] bg-white p-3 text-xs text-[var(--mikke-text-soft)]">
      <h4 className="text-sm font-bold text-[var(--mikke-text)]">{row.title}</h4>
      <dl className="mt-2 grid gap-1.5">
        <ReadLine label="source_service" value={row.source_service} />
        <ReadLine label="category" value={row.category} />
        <ReadLine label="visibility" value={row.visibility} />
        <ReadLine label="amount" value={row.amount === null ? "null" : String(row.amount)} />
        <ReadLine label="transaction_type" value={row.transaction_type} />
        <ReadLine label="Story" value={isStoryVisibleLog(row) ? "対象" : "非対象"} />
        <ReadLine label="DESK" value={isDeskCountedLog(row) ? "対象" : "非対象"} />
        <ReadLine label="活動実績" value={isSummaryCountedLog(row) ? "対象" : "非対象"} />
        <ReadLine label="occurred_at" value={formatDateTime(row.occurred_at)} />
        <ReadLine label="created_at" value={formatDateTime(row.created_at)} />
      </dl>
    </article>
  );
}

function ReadLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-2">
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
