"use client";

import { useMemo } from "react";
import { useMikkeEvents } from "@/lib/event/store";
import { useItemStudio } from "@/lib/item-studio/store";
import { useUnifiedActivityLogs } from "@/lib/mikkeos/activity-client-store";
import { mockProfile } from "@/lib/mikkeos/mock-data";
import { useSessionMenus } from "@/lib/session/store";
import type { PageCmsSource } from "./types";

export type PageCmsItem = {
  id: string;
  source: PageCmsSource;
  title: string;
  summary: string;
  imageUrl: string;
  meta: string;
  occurredAt: string;
  approved: boolean;
};

export function usePageCmsContent() {
  const { items } = useItemStudio();
  const { events } = useMikkeEvents();
  const { menus } = useSessionMenus();
  const { logs } = useUnifiedActivityLogs();

  return useMemo<Record<PageCmsSource, PageCmsItem[]>>(() => ({
    story: [
      {
        id: mockProfile.id,
        source: "story",
        title: mockProfile.brandName || mockProfile.displayName,
        summary: mockProfile.bio,
        imageUrl: mockProfile.iconUrl ?? "",
        meta: [mockProfile.area, `@${mockProfile.handle}`].filter(Boolean).join(" / "),
        occurredAt: mockProfile.createdAt,
        approved: true
      }
    ],
    item_studio: items
      .filter((item) => item.published)
      .map((item) => ({
        id: item.id,
        source: "item_studio",
        title: item.title,
        summary: item.description,
        imageUrl: item.photoUrl,
        meta: [item.category, item.price === null ? "" : `${item.price.toLocaleString("ja-JP")}円`].filter(Boolean).join(" / "),
        occurredAt: item.createdAt,
        approved: true
      })),
    event: events
      .filter((event) => event.status === "published")
      .map((event) => ({
        id: event.id,
        source: "event",
        title: event.title,
        summary: event.summary,
        imageUrl: event.coverImageUrl,
        meta: [event.eventDate, event.venueName].filter(Boolean).join(" / "),
        occurredAt: event.eventDate,
        approved: true
      })),
    academy: logs
      .filter((log) => log.appKey === "academy" && log.visibility === "public" && log.storyEnabled)
      .map((log) => ({
        id: log.id,
        source: "academy",
        title: log.title,
        summary: log.description ?? "",
        imageUrl: "",
        meta: log.metadata?.sourceLabel ?? "Academy",
        occurredAt: log.occurredAt,
        approved: true
      })),
    session: menus
      .filter((menu) => menu.published)
      .map((menu) => ({
        id: menu.id,
        source: "session",
        title: menu.title,
        summary: menu.summary,
        imageUrl: "",
        meta: [menu.durationLabel, menu.price === null ? "" : `${menu.price.toLocaleString("ja-JP")}円`].filter(Boolean).join(" / "),
        occurredAt: menu.createdAt,
        approved: true
      }))
  }), [events, items, logs, menus]);
}
