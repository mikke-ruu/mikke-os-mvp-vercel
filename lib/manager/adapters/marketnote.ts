"use client";

import { useEffect, useState } from "react";
import { hasAppliedEntryStatus, listCheckItems, listMarketEvents } from "@/lib/marketnote";
import type { MarketCheckItem, MarketEvent } from "@/types/database";
import type { ManagerBridge, ManagerProgress, ManagerProgressStatus, ManagerScheduleItem, ManagerTask } from "../types";
import { classifyManagerDueDate, compareManagerDue, compareManagerItems, progressFromStatus } from "./utils";

type MarketNoteManagerState = ManagerBridge & {
  loading: boolean;
  errorMessage: string | null;
};

const emptyBridge: ManagerBridge = {
  schedules: [],
  tasks: [],
  progress: []
};

const completedStatuses: MarketEvent["status"][] = ["completed", "cancelled"];

export function useMarketNoteManagerBridge(profileId: string | undefined): MarketNoteManagerState {
  const [state, setState] = useState<MarketNoteManagerState>({ ...emptyBridge, loading: true, errorMessage: null });

  useEffect(() => {
    if (!profileId) {
      setState({ ...emptyBridge, loading: false, errorMessage: null });
      return;
    }

    let cancelled = false;
    const activeProfileId = profileId;

    async function load() {
      setState((current) => ({ ...current, loading: true, errorMessage: null }));

      try {
        const events = await listMarketEvents(activeProfileId);
        const checksByEventEntries = await Promise.all(
          events.map(async (event) => {
            try {
              return [event.id, await listCheckItems(activeProfileId, event.id)] as const;
            } catch {
              return [event.id, [] as MarketCheckItem[]] as const;
            }
          })
        );

        if (cancelled) return;
        const checksByEvent = new Map(checksByEventEntries);
        const bridge = collectMarketNoteManagerBridge(events, checksByEvent, new Date());
        setState({ ...bridge, loading: false, errorMessage: null });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "MarketNoteの予定を取得できませんでした";
        setState({ ...emptyBridge, loading: false, errorMessage: message });
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  return state;
}

export function collectMarketNoteManagerBridge(
  events: MarketEvent[],
  checksByEvent: Map<string, MarketCheckItem[]>,
  now = new Date()
): ManagerBridge {
  const visibleEvents = events.filter((event) => event.status !== "cancelled");

  const schedules: ManagerScheduleItem[] = visibleEvents
    .map((event) => ({
      id: `marketnote_event_schedule:${event.id}`,
      kind: "schedule" as const,
      title: `${event.title}の出店日`,
      description: [statusLabel(event), event.venue_name, event.area].filter(Boolean).join(" / "),
      dueAt: event.event_date || null,
      urgency: classifyManagerDueDate(event.event_date, now),
      status: toManagerStatus(event),
      source: {
        appKey: "marketnote" as const,
        sourceType: "event" as const,
        sourceId: event.id,
        href: `/marketnote/${event.id}`
      }
    }))
    .sort((a, b) => compareManagerItems(a, b, now));

  const tasks: ManagerTask[] = visibleEvents
    .flatMap((event) =>
      (checksByEvent.get(event.id) ?? [])
        .filter((check) => !check.is_done)
        .map((check) => ({
          id: `marketnote_check_task:${check.id}`,
          kind: "task" as const,
          title: check.title,
          description: `${event.title} / 出店準備`,
          dueAt: check.due_date || event.event_date || null,
          urgency: classifyManagerDueDate(check.due_date || event.event_date, now),
          status: event.status === "completed" ? "completed" as const : "active" as const,
          priority: classifyManagerDueDate(check.due_date || event.event_date, now) === "overdue" ? "high" as const : "normal" as const,
          ownerLabel: "MarketNote",
          source: {
            appKey: "marketnote" as const,
            sourceType: "task" as const,
            sourceId: check.id,
            sourceGroupId: event.id,
            href: `/marketnote/${event.id}`
          }
        }))
    )
    .sort((a, b) => compareManagerItems(a, b, now));

  const progress: ManagerProgress[] = visibleEvents
    .filter((event) => !completedStatuses.includes(event.status))
    .map((event) => {
      const checks = checksByEvent.get(event.id) ?? [];
      const doneCount = checks.filter((check) => check.is_done).length;
      const progressPercent = checks.length > 0 ? Math.round((doneCount / checks.length) * 100) : progressFromStatus(event.status);
      return {
        id: `marketnote_event_progress:${event.id}`,
        title: event.title,
        description: statusLabel(event),
        progressPercent,
        status: toManagerStatus(event),
        statusLabel: statusLabel(event),
        dueAt: event.event_date || null,
        urgency: classifyManagerDueDate(event.event_date, now),
        source: {
          appKey: "marketnote" as const,
          sourceType: "event" as const,
          sourceId: event.id,
          href: `/marketnote/${event.id}`
        }
      };
    })
    .sort((a, b) => compareManagerDue(a.dueAt, b.dueAt, now));

  return { schedules, tasks, progress };
}

function toManagerStatus(event: MarketEvent): ManagerProgressStatus {
  if (event.status === "completed") return "completed";
  if (event.status === "cancelled") return "cancelled";
  if (event.status === "preparing") return "active";
  if (hasAppliedEntryStatus(event.private_note)) return "waiting";
  return "not_started";
}

function statusLabel(event: MarketEvent) {
  if (hasAppliedEntryStatus(event.private_note)) return "申込済み";
  if (event.status === "planned") return "予定";
  if (event.status === "preparing") return "準備中";
  if (event.status === "completed") return "完了";
  return "中止";
}
