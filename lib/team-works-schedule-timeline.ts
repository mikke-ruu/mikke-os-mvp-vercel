import type { OperationsCalendarEvent, OperationsScheduleGroup } from "@/lib/team-works-operations";
import type { DeliveryCalendarItem } from "@/components/team-works/projects/TeamWorksDeliveryCalendar";

// スケジュール管理ページ用。運営型のコマ(loadOperationsScheduleGroups)と納品型の期日
// (buildDeliveryCalendarItems)は別々の関数・別々の形のデータのまま(既存2関数は変更しない)、
// この関数だけが日付キーでまとめる。あゆみ指摘(2026-07-30)「納品型の期日ブロックが上に
// ドンと乗っていて別物感がある」への対応。

export type ScheduleTimelineEntry =
  | { kind: "ops"; sortKey: string; event: OperationsCalendarEvent }
  | { kind: "delivery"; sortKey: string; item: DeliveryCalendarItem };

export type ScheduleTimelineGroup = {
  dateKey: string;
  label: string;
  entries: ScheduleTimelineEntry[];
};

const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

function formatGroupLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}（${weekdayLabels[date.getDay()]}）`;
}

export function mergeScheduleTimeline(
  opsGroups: OperationsScheduleGroup[],
  deliveryItems: DeliveryCalendarItem[]
): ScheduleTimelineGroup[] {
  const byDate = new Map<string, ScheduleTimelineEntry[]>();

  for (const group of opsGroups) {
    for (const event of group.events) {
      const list = byDate.get(group.dateKey) ?? [];
      list.push({ kind: "ops", sortKey: event.startTime, event });
      byDate.set(group.dateKey, list);
    }
  }

  for (const item of deliveryItems) {
    const list = byDate.get(item.date) ?? [];
    // 納品期日は時刻を持たないため、同じ日のコマより後ろに並ぶようにする。
    list.push({ kind: "delivery", sortKey: "24:00", item });
    byDate.set(item.date, list);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, entries]) => ({
      dateKey,
      label: formatGroupLabel(dateKey),
      entries: entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    }));
}
