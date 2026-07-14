"use client";

import { useEffect, useState } from "react";
import { mockActivityLogs } from "./mock-data";
import type { UnifiedActivityLog } from "./types";

const STORAGE_KEY = "mikkeos.activityLogs.v1";

function readLogsFromStorage() {
  if (typeof window === "undefined") return mockActivityLogs;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return mockActivityLogs;

  try {
    const parsed = JSON.parse(stored) as UnifiedActivityLog[];
    return Array.isArray(parsed) ? parsed : mockActivityLogs;
  } catch {
    return mockActivityLogs;
  }
}

function writeLogsToStorage(logs: UnifiedActivityLog[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  window.dispatchEvent(new CustomEvent("mikkeos:activity-logs-updated"));
}

export function useUnifiedActivityLogs() {
  const [logs, setLogs] = useState<UnifiedActivityLog[]>(mockActivityLogs);

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
    writeLogsToStorage(mockActivityLogs);
    setLogs(mockActivityLogs);
  }

  return { logs, addLog, removeLog, resetLogs };
}
