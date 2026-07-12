export type SupabaseActivityLogDestinationFields = {
  visibility: "public" | "private" | "limited";
  display_on_story: boolean;
  counts_toward_summary: boolean;
  has_financial_value: boolean;
  amount: number | null;
  transaction_type: "revenue" | "expense" | "none";
};

export function isStoryVisibleLog(log: SupabaseActivityLogDestinationFields) {
  return log.visibility === "public" && log.display_on_story === true;
}

export function isDeskCountedLog(log: SupabaseActivityLogDestinationFields) {
  return (
    log.has_financial_value === true &&
    log.amount !== null &&
    (log.transaction_type === "revenue" || log.transaction_type === "expense")
  );
}

export function isSummaryCountedLog(log: SupabaseActivityLogDestinationFields) {
  return log.counts_toward_summary === true;
}

export function splitActivityLogsByDestination<TLog extends SupabaseActivityLogDestinationFields>(logs: TLog[]) {
  return {
    storyLogs: logs.filter(isStoryVisibleLog),
    deskLogs: logs.filter(isDeskCountedLog),
    summaryLogs: logs.filter(isSummaryCountedLog)
  };
}
