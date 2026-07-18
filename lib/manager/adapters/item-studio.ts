"use client";

import { useItemStudio } from "@/lib/item-studio/store";
import { channelStatusLabels, type StudioChannel, type StudioItem, type StudioSale } from "@/lib/item-studio/types";
import type { ManagerBridge, ManagerProgress, ManagerScheduleItem, ManagerTask } from "../types";
import { classifyManagerDueDate, compareManagerDue, compareManagerItems } from "./utils";

export function useItemStudioManagerBridge(now = new Date()): ManagerBridge {
  const { items, channels, sales } = useItemStudio();
  return collectItemStudioManagerBridge(items, channels, sales, now);
}

export function collectItemStudioManagerBridge(items: StudioItem[], channels: StudioChannel[], sales: StudioSale[], now = new Date()): ManagerBridge {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const activeItems = items.filter((item) => item.stock > 0);

  const tasks: ManagerTask[] = [
    ...activeItems
      .filter((item) => !item.published)
      .map((item): ManagerTask => ({
        id: `item_studio_publish_task:${item.id}`,
        kind: "task",
        title: `${item.title}を公開準備`,
        description: "作品ページの公開準備",
        dueAt: null,
        urgency: "unscheduled",
        status: "not_started",
        priority: "normal",
        ownerLabel: "Item Studio",
        source: createItemSource(item.id)
      })),
    ...channels
      .filter((channel) => channel.status === "not_listed" && itemById.has(channel.itemId))
      .map((channel): ManagerTask => {
        const item = itemById.get(channel.itemId);
        return {
          id: `item_studio_channel_task:${channel.id}`,
          kind: "task",
          title: `${item?.title ?? "作品"}を${channel.channelName}へ出品`,
          description: channelStatusLabels[channel.status],
          dueAt: null,
          urgency: "unscheduled",
          status: "not_started",
          priority: "normal",
          ownerLabel: "Item Studio",
          source: {
            appKey: "item_studio",
            sourceType: "channel",
            sourceId: channel.id,
            sourceGroupId: channel.itemId,
            href: `/item-studio/${channel.itemId}`
          }
        };
      })
  ].sort((a, b) => compareManagerItems(a, b, now));

  const progress: ManagerProgress[] = activeItems
    .map((item): ManagerProgress => {
      const itemChannels = channels.filter((channel) => channel.itemId === item.id);
      const listedCount = itemChannels.filter((channel) => channel.status === "listed" || channel.status === "sold").length;
      const progressPercent = item.published ? (itemChannels.length ? Math.round((listedCount / itemChannels.length) * 100) : 70) : 20;
      return {
        id: `item_studio_item_progress:${item.id}`,
        title: item.title,
        description: itemChannels.length ? `出品先 ${listedCount}/${itemChannels.length}` : "作品登録済み",
        progressPercent,
        status: item.published ? "active" : "not_started",
        statusLabel: item.published ? "公開中" : "準備中",
        dueAt: null,
        urgency: "unscheduled",
        source: createItemSource(item.id)
      };
    })
    .sort((a, b) => compareManagerDue(a.dueAt, b.dueAt, now) || a.title.localeCompare(b.title, "ja"));

  const schedules: ManagerScheduleItem[] = sales
    .map((sale) => ({
      id: `item_studio_sale_schedule:${sale.id}`,
      kind: "schedule" as const,
      title: `${itemById.get(sale.itemId)?.title ?? "作品"}の販売記録`,
      description: `${sale.channelName} / ¥${sale.soldPrice.toLocaleString("ja-JP")}`,
      dueAt: sale.soldAt,
      urgency: classifyManagerDueDate(sale.soldAt, now),
      status: "completed" as const,
      source: {
        appKey: "item_studio" as const,
        sourceType: "sale" as const,
        sourceId: sale.id,
        sourceGroupId: sale.itemId,
        href: `/item-studio/${sale.itemId}`
      }
    }))
    .sort((a, b) => compareManagerItems(a, b, now));

  return { schedules, tasks, progress };
}

function createItemSource(itemId: string) {
  return {
    appKey: "item_studio" as const,
    sourceType: "item" as const,
    sourceId: itemId,
    href: `/item-studio/${itemId}`
  };
}
