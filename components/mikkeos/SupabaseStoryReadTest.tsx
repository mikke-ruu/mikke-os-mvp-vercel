"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpenText, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { isStoryVisibleLog } from "@/lib/mikkeos/activity-log-filters";

type SupabaseStoryReadRow = {
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
  occurred_at: string;
  created_at: string;
};

type ReadState =
  | { status: "loading"; message: string; rows: SupabaseStoryReadRow[] }
  | { status: "success"; message: string; rows: SupabaseStoryReadRow[] }
  | { status: "empty"; message: string; rows: SupabaseStoryReadRow[] }
  | { status: "error"; message: string; rows: SupabaseStoryReadRow[] };

const storyReadSelect =
  "id,title,source_service,category,visibility,display_on_story,counts_toward_summary,has_financial_value,amount,transaction_type,occurred_at,created_at";

export function SupabaseStoryReadTest() {
  const [state, setState] = useState<ReadState>({
    status: "loading",
    message: "Supabase Story読み取りテストを確認しています。",
    rows: []
  });

  const readStoryLogs = useCallback(async () => {
    setState({ status: "loading", message: "SupabaseからStory対象ログを読み取っています。", rows: [] });

    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError) {
      setState({ status: "error", message: sessionError.message, rows: [] });
      return;
    }

    if (!session?.user) {
      setState({ status: "error", message: "Supabase story read test needs a logged-in user.", rows: [] });
      return;
    }

    const { data, error } = await supabase
      .from("activity_logs")
      .select(storyReadSelect)
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) {
      setState({ status: "error", message: error.message, rows: [] });
      return;
    }

    const rows = (data ?? []) as SupabaseStoryReadRow[];
    const storyRows = rows.filter(isStoryVisibleLog);
    setState({
      status: storyRows.length > 0 ? "success" : "empty",
      message:
        storyRows.length > 0
          ? `${storyRows.length}件のStory対象ログを読み取りました。`
          : "Story対象ログはまだ見つかりません。",
      rows
    });
  }, []);

  useEffect(() => {
    void readStoryLogs();
  }, [readStoryLogs]);

  const storyRows = state.rows.filter(isStoryVisibleLog);
  const hiddenRows = state.rows.length - storyRows.length;

  return (
    <section className="mt-6 rounded-2xl border border-dashed border-[#d8c8bb] bg-[#fffaf6] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-full bg-white p-2 text-[#d9643a]">
            <BookOpenText size={18} />
          </span>
          <div>
            <h2 className="text-sm font-bold tracking-normal text-[#25211f]">Supabase Story読み取りテスト</h2>
            <p className="mt-1 text-xs leading-5 text-[#79716b]">
              通常のStory表示はそのまま、Supabaseから読み取ったログをStory対象条件だけで確認します。
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void readStoryLogs()}
          disabled={state.status === "loading"}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e8e1da] bg-white px-3 py-2 text-xs font-bold text-[#5f5a55] disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw size={14} />
          再読込
        </button>
      </div>

      <p className={`mt-3 text-xs font-bold ${state.status === "error" ? "text-[#b54747]" : "text-[#4f8a61]"}`}>
        {state.message}
      </p>

      {state.rows.length > 0 ? (
        <div className="mt-4 border-t border-[#eadfd6] pt-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <StoryCount label="Story対象" value={storyRows.length} />
            <StoryCount label="Story非対象" value={hiddenRows} muted />
          </div>

          {storyRows.length > 0 ? (
            <div className="mt-3 grid gap-3">
              {storyRows.map((row) => (
                <SupabaseStoryReadCard key={row.id} row={row} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs font-bold text-[#8a817a]">Story対象ログはありません。</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function StoryCount({ label, value, muted = false }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={`rounded-2xl border border-[#e8e1da] bg-white p-3 text-center ${muted ? "opacity-75" : ""}`}>
      <p className="text-[11px] font-bold text-[#8a817a]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[#25211f]">{value}件</p>
    </div>
  );
}

function SupabaseStoryReadCard({ row }: { row: SupabaseStoryReadRow }) {
  return (
    <article className="rounded-2xl border border-[#e8e1da] bg-white p-3 text-xs text-[#5f5a55]">
      <h3 className="text-sm font-bold text-[#25211f]">{row.title}</h3>
      <dl className="mt-2 grid gap-1.5">
        <ReadLine label="source_service" value={row.source_service} />
        <ReadLine label="category" value={row.category} />
        <ReadLine label="visibility" value={row.visibility} />
        <ReadLine label="display_on_story" value={String(row.display_on_story)} />
        <ReadLine label="counts_toward_summary" value={String(row.counts_toward_summary)} />
        <ReadLine label="has_financial_value" value={String(row.has_financial_value)} />
        <ReadLine label="transaction_type" value={row.transaction_type} />
        <ReadLine label="occurred_at" value={formatDateTime(row.occurred_at)} />
        <ReadLine label="created_at" value={formatDateTime(row.created_at)} />
      </dl>
    </article>
  );
}

function ReadLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-2">
      <dt className="font-bold text-[#8a817a]">{label}</dt>
      <dd className="break-words text-[#25211f]">{value}</dd>
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
