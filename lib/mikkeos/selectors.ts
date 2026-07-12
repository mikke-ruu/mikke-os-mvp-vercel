import { appByKey, mikkeApps } from "./apps";
import { getSummaryLogs } from "./activity-summary";
import type { AppKey, UnifiedActivityLog } from "./types";

export function sortLogs(logs: UnifiedActivityLog[]) {
  return [...logs].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function getStoryLogs(logs: UnifiedActivityLog[]) {
  return sortLogs(logs).filter((log) => log.visibility === "public" && log.storyEnabled);
}

export function getDeskLogs(logs: UnifiedActivityLog[]) {
  return sortLogs(logs).filter((log) => log.deskEnabled && log.amountType !== "none" && typeof log.amount === "number");
}

export function getDeskSummary(logs: UnifiedActivityLog[]) {
  const deskLogs = getDeskLogs(logs);
  const income = deskLogs.filter((log) => log.amountType === "income").reduce((sum, log) => sum + (log.amount ?? 0), 0);
  const expense = deskLogs.filter((log) => log.amountType === "expense").reduce((sum, log) => sum + (log.amount ?? 0), 0);
  const unpaid = deskLogs
    .filter((log) => log.metadata?.paymentStatus === "unpaid")
    .reduce((sum, log) => sum + (log.amount ?? 0), 0);

  return {
    income,
    expense,
    profit: income - expense,
    unpaid,
    rows: deskLogs
  };
}

export function getAppFinancialRows(logs: UnifiedActivityLog[]) {
  const deskLogs = getDeskLogs(logs);

  return mikkeApps.map((app) => {
    const rows = deskLogs.filter((log) => log.appKey === app.key);
    const income = rows.filter((log) => log.amountType === "income").reduce((sum, log) => sum + (log.amount ?? 0), 0);
    const expense = rows.filter((log) => log.amountType === "expense").reduce((sum, log) => sum + (log.amount ?? 0), 0);
    return {
      app,
      income,
      expense,
      profit: income - expense,
      count: rows.length
    };
  });
}

export function getOsSummary(logs: UnifiedActivityLog[]) {
  const desk = getDeskSummary(logs);
  const summaryLogs = getSummaryLogs(logs);
  return {
    totalLogs: summaryLogs.length,
    allLogs: logs.length,
    storyLogs: getStoryLogs(logs).length,
    deskLogs: desk.rows.length,
    income: desk.income,
    expense: desk.expense,
    profit: desk.profit,
    activeApps: new Set(logs.map((log) => log.appKey)).size
  };
}

export function groupStoryLogsBySection(logs: UnifiedActivityLog[]) {
  return getStoryLogs(logs).reduce<Record<string, UnifiedActivityLog[]>>((acc, log) => {
    const section = log.metadata?.storySection ?? appByKey[log.appKey].name;
    acc[section] = [...(acc[section] ?? []), log];
    return acc;
  }, {});
}

export function filterLogs(logs: UnifiedActivityLog[], filter: "all" | AppKey | "income" | "expense" | "public" | "private") {
  if (filter === "all") return sortLogs(logs);
  if (filter === "income" || filter === "expense") {
    return sortLogs(logs).filter((log) => log.amountType === filter);
  }
  if (filter === "public" || filter === "private") {
    return sortLogs(logs).filter((log) => log.visibility === filter);
  }
  return sortLogs(logs).filter((log) => log.appKey === filter);
}
