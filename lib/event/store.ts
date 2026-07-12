"use client";

import { useEffect, useState } from "react";
import type { ApplicationStatus, EventApplication, MikkeEvent } from "./types";

const EVENTS_KEY = "mikke.event.events.v1";
const APPLICATIONS_KEY = "mikke.event.applications.v1";
const UPDATED_EVENT_NAME = "mikke-event:updated";

// Event MVPはlocalStorage保存のみ（Supabase/Activity Log接続は後続フェーズ）。
const mockOwnerProfileId = "local-owner";

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const seedEvents: MikkeEvent[] = [
  {
    id: "event_seed_1",
    ownerProfileId: mockOwnerProfileId,
    title: "ハンドメイド小さな市",
    summary: "手づくり作家が集まる、小さな出店イベントです。",
    description: "初めての方も参加しやすい、小規模なマルシェです。屋内会場・雨天決行。",
    eventDate: nextWeekday(14),
    startTime: "10:00",
    endTime: "16:00",
    venueName: "コミュニティスペースmusubi",
    venueAddress: "東京都内（申込確定後にご案内します）",
    mapUrl: "",
    coverImageUrl: "",
    feeLabel: "出店料",
    feeAmount: 3000,
    capacity: 12,
    applicationOpen: true,
    status: "published",
    organizerNotice: "搬入は開始1時間前から可能です。",
    createdAt: nowIso(),
    updatedAt: nowIso()
  }
];

function nextWeekday(daysAhead: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

function readEvents(): MikkeEvent[] {
  if (typeof window === "undefined") return seedEvents;
  const raw = window.localStorage.getItem(EVENTS_KEY);
  if (!raw) return seedEvents;
  try {
    const parsed = JSON.parse(raw) as MikkeEvent[];
    return Array.isArray(parsed) ? parsed : seedEvents;
  } catch {
    return seedEvents;
  }
}

function writeEvents(events: MikkeEvent[]) {
  window.localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  window.dispatchEvent(new CustomEvent(UPDATED_EVENT_NAME));
}

function readApplications(): EventApplication[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(APPLICATIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as EventApplication[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeApplications(applications: EventApplication[]) {
  window.localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(applications));
  window.dispatchEvent(new CustomEvent(UPDATED_EVENT_NAME));
}

export function useMikkeEvents() {
  const [events, setEvents] = useState<MikkeEvent[]>(seedEvents);
  const [applications, setApplications] = useState<EventApplication[]>([]);

  useEffect(() => {
    function refresh() {
      setEvents(readEvents());
      setApplications(readApplications());
    }
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(UPDATED_EVENT_NAME, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(UPDATED_EVENT_NAME, refresh);
    };
  }, []);

  function createEvent(input: Omit<MikkeEvent, "id" | "ownerProfileId" | "createdAt" | "updatedAt">) {
    const event: MikkeEvent = {
      ...input,
      id: makeId("event"),
      ownerProfileId: mockOwnerProfileId,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    const next = [event, ...readEvents()];
    writeEvents(next);
    setEvents(next);
    return event;
  }

  function updateEvent(id: string, patch: Partial<MikkeEvent>) {
    const next = readEvents().map((event) => (event.id === id ? { ...event, ...patch, updatedAt: nowIso() } : event));
    writeEvents(next);
    setEvents(next);
  }

  function createApplication(input: Omit<EventApplication, "id" | "status" | "organizerMemo" | "confirmedMemo" | "createdAt" | "updatedAt">) {
    const application: EventApplication = {
      ...input,
      id: makeId("application"),
      status: "submitted",
      organizerMemo: "",
      confirmedMemo: "",
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    const next = [application, ...readApplications()];
    writeApplications(next);
    setApplications(next);
    return application;
  }

  function updateApplication(id: string, patch: Partial<EventApplication>) {
    const next = readApplications().map((application) =>
      application.id === id ? { ...application, ...patch, updatedAt: nowIso() } : application
    );
    writeApplications(next);
    setApplications(next);
  }

  function updateApplicationStatus(id: string, status: ApplicationStatus) {
    updateApplication(id, { status });
  }

  return { events, applications, createEvent, updateEvent, createApplication, updateApplication, updateApplicationStatus };
}
