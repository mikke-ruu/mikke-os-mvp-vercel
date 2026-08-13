"use client";

import { useEffect, useState } from "react";
import type { UnifiedActivityLog } from "./types";

const STORAGE_KEY = "mikkeos.activityLogs.v1";

/**
 * Activity Logは内部台帳であり、見本データを持たない。
 * 記録が無いときは必ず空にする（架空の売上・経費を画面に出さないため）。
 */
const EMPTY_LOGS: UnifiedActivityLog[] = [];

function readLogsFromStorage() {
  if (typeof window === "undefined") return EMPTY_LOGS;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return EMPTY_LOGS;

  try {
    const parsed = JSON.parse(stored) as UnifiedActivityLog[];
    return Array.isArray(parsed) ? parsed : EMPTY_LOGS;
  } catch {
    return EMPTY_LOGS;
  }
}

function writeLogsToStorage(logs: UnifiedActivityLog[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  window.dispatchEvent(new CustomEvent("mikkeos:activity-logs-updated"));
}

export function useUnifiedActivityLogs() {
  const [logs, setLogs] = useState<UnifiedActivityLog[]>(EMPTY_LOGS);

  useEffect(() => {
    setLogs(readLogsFromStorage());

    function refresh() {
      setLogs(readLogsFromStorage());
    }

    window.addEventListener("storage", refresh);
    window.addEventListener("mikkeos:activity-logs-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("mikkeos:activity-logs-updated", refresh);
    };
  }, []);

  function addLog(log: UnifiedActivityLog) {
    const nextLogs = [
      log,
      ...readLogsFromStorage().filter(
        (existing) =>
          existing.appKey !== log.appKey ||
          existing.sourceId !== log.sourceId ||
          existing.eventType !== log.eventType
      )
    ];
    writeLogsToStorage(nextLogs);
    setLogs(nextLogs);
  }

  function removeLog(appKey: UnifiedActivityLog["appKey"], sourceId: string, eventType: string) {
    const nextLogs = readLogsFromStorage().filter(
      (log) => log.appKey !== appKey || log.sourceId !== sourceId || log.eventType !== eventType
    );
    writeLogsToStorage(nextLogs);
    setLogs(nextLogs);
  }

  function resetLogs() {
    writeLogsToStorage(EMPTY_LOGS);
    setLogs(EMPTY_LOGS);
  }

  return { logs, addLog, removeLog, resetLogs };
}
