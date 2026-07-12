"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  isDeskCountedLog,
  isStoryVisibleLog,
  isSummaryCountedLog,
  splitActivityLogsByDestination
} from "@/lib/mikkeos/activity-log-filters";

type SupabaseActivityLogReadRow = {
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
  | { status: "loading"; message: string; rows: SupabaseActivityLogReadRow[] }
  | { status: "success"; message: string; rows: SupabaseActivityLogReadRow[] }
  | { status: "empty"; message: string; rows: SupabaseActivityLogReadRow[] }
  | { status: "error"; message: string; rows: SupabaseActivityLogReadRow[] };

const activityLogReadSelect =
  "id,title,source_service,category,visibility,display_on_story,counts_toward_summary,has_financial_value,amount,transaction_type,payment_status,occurred_at,created_at";

export function SupabaseLogReadTest() {
  const [state, setState] = useState<ReadState>({
    status: "loading",
    message: "Supabase読み取りテストを確認しています。",
    rows: []
  });

  const readLogs = useCallback(async () => {
    setState({ status: "loading", message: "SupabaseからItem Studioログを読み取っています。", rows: [] });

    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError) {
      setState({ status: "error", message: sessionError.message, rows: [] });
      return;
    }

    if (!session?.user) {
      setState({ status: "error", message: "Supabase read test needs a logged-in user.", rows: [] });
      return;
    }

    const { data, error } = await supabase
      .from("activity_logs")
      .select(activityLogReadSelect)
      .eq("source_service", "item_studio")
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      setState({ status: "error", message: error.message, rows: [] });
      return;
    }

    const rows = (data ?? []) as SupabaseActivityLogReadRow[];
    setState({
      status: rows.length > 0 ? "success" : "empty",
      message: rows.length > 0 ? `${rows.length}件のItem Studioログを読み取りました。` : "Item Studioログはまだ見つかりません。",
      rows
    });
  }, []);

  useEffect(() => {
    void readLogs();
  }, [readLogs]);

  return (
    <section className="mt-6 rounded-2xl border border-dashed border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-full bg-white p-2 text-[var(--mikke-accent)]">
            <Database size={18} />
          </span>
          <div>
            <h2 className="text-sm font-bold tracking-normal text-[var(--mikke-text)]">Supabase読み取りテスト</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">
              通常のLog表示はlocalStorageのまま、ログイン済みユーザーのItem StudioログだけをSupabaseから確認します。
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void readLogs()}
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
        <>
          <SupabaseTargetExtraction rows={state.rows} />
          <div className="mt-4 grid gap-3">
            {state.rows.map((row) => (
              <SupabaseLogReadCard key={row.id} row={row} />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function SupabaseTargetExtraction({ rows }: { rows: SupabaseActivityLogReadRow[] }) {
  const { storyLogs, deskLogs, summaryLogs } = splitActivityLogsByDestination(rows);

  return (
    <div className="mt-4 border-t border-[var(--mikke-line-soft)] pt-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <TargetCount label="Story対象" value={storyLogs.length} />
        <TargetCount label="DESK対象" value={deskLogs.length} />
        <TargetCount label="活動実績対象" value={summaryLogs.length} />
      </div>

      <div className="mt-3 grid gap-3">
        <TargetLogGroup title="Story対象ログ" rows={storyLogs} />
        <TargetLogGroup title="DESK対象ログ" rows={deskLogs} />
        <TargetLogGroup title="活動実績対象ログ" rows={summaryLogs} />
      </div>
    </div>
  );
}

function TargetCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-3 text-center">
      <p className="text-[11px] font-bold text-[var(--mikke-muted-light)]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[var(--mikke-text)]">{value}件</p>
    </div>
  );
}

function TargetLogGroup({ title, rows }: { title: string; rows: SupabaseActivityLogReadRow[] }) {
  return (
    <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-3">
      <h3 className="text-xs font-bold text-[var(--mikke-text)]">{title}</h3>
      {rows.length > 0 ? (
        <div className="mt-2 grid gap-2">
          {rows.map((row) => (
            <TargetLogSummary key={`${title}-${row.id}`} row={row} />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs font-bold text-[var(--mikke-muted-light)]">対象ログはありません。</p>
      )}
    </section>
  );
}

function TargetLogSummary({ row }: { row: SupabaseActivityLogReadRow }) {
  return (
    <article className="rounded-xl bg-[var(--mikke-surface-soft)] p-3 text-xs text-[var(--mikke-text-soft)]">
      <p className="font-bold text-[var(--mikke-text)]">{row.title}</p>
      <dl className="mt-2 grid gap-1.5">
        <ReadLine label="source_service" value={row.source_service} />
        <ReadLine label="category" value={row.category} />
        <ReadLine label="amount" value={row.amount === null ? "null" : String(row.amount)} />
        <ReadLine label="transaction_type" value={row.transaction_type} />
        <ReadLine label="visibility" value={row.visibility} />
        <ReadLine label="display_on_story" value={String(row.display_on_story)} />
        <ReadLine label="counts_toward_summary" value={String(row.counts_toward_summary)} />
        <ReadLine label="has_financial_value" value={String(row.has_financial_value)} />
      </dl>
    </article>
  );
}

function SupabaseLogReadCard({ row }: { row: SupabaseActivityLogReadRow }) {
  return (
    <article className="rounded-2xl border border-[var(--mikke-line)] bg-white p-3 text-xs text-[var(--mikke-text-soft)]">
      <h3 className="text-sm font-bold text-[var(--mikke-text)]">{row.title}</h3>
      <dl className="mt-2 grid gap-1.5">
        <ReadLine label="source_service" value={row.source_service} />
        <ReadLine label="category" value={row.category} />
        <ReadLine label="visibility" value={row.visibility} />
        <ReadLine label="display_on_story" value={String(row.display_on_story)} />
        <ReadLine label="counts_toward_summary" value={String(row.counts_toward_summary)} />
        <ReadLine label="has_financial_value" value={String(row.has_financial_value)} />
        <ReadLine label="amount" value={row.amount === null ? "null" : String(row.amount)} />
        <ReadLine label="transaction_type" value={row.transaction_type} />
        <ReadLine label="payment_status" value={row.payment_status} />
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
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2">
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
