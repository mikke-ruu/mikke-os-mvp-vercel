"use client";

import { useEffect, useState } from "react";
import type { ManagerPersonalEvent, ManagerPreferences, ManagerScheduleItem } from "./types";
import { classifyManagerDueDate, compareManagerItems } from "./adapters/utils";

const PERSONAL_EVENTS_KEY = "mikke.manager.personal-events.v1";
const PREFERENCES_KEY = "mikke.manager.preferences.v1";
const UPDATED_EVENT_NAME = "mikke-manager:updated";

const defaultPreferences: ManagerPreferences = {
  defaultView: "dashboard",
  showCompleted: false
};

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readPersonalEvents(): ManagerPersonalEvent[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(PERSONAL_EVENTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ManagerPersonalEvent[];
    return Array.isArray(parsed) ? parsed.map(normalizePersonalEvent) : [];
  } catch {
    return [];
  }
}

function writePersonalEvents(events: ManagerPersonalEvent[]) {
  window.localStorage.setItem(PERSONAL_EVENTS_KEY, JSON.stringify(events));
  window.dispatchEvent(new CustomEvent(UPDATED_EVENT_NAME));
}

function readPreferences(): ManagerPreferences {
  if (typeof window === "undefined") return defaultPreferences;
  const raw = window.localStorage.getItem(PREFERENCES_KEY);
  if (!raw) return defaultPreferences;
  try {
    const parsed = JSON.parse(raw) as Partial<ManagerPreferences>;
    return { ...defaultPreferences, ...parsed };
  } catch {
    return defaultPreferences;
  }
}

function writePreferences(preferences: ManagerPreferences) {
  window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  window.dispatchEvent(new CustomEvent(UPDATED_EVENT_NAME));
}

export function useManagerPersonalEvents() {
  const [personalEvents, setPersonalEvents] = useState<ManagerPersonalEvent[]>([]);

  useEffect(() => {
    function refresh() {
      setPersonalEvents(readPersonalEvents());
    }
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(UPDATED_EVENT_NAME, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(UPDATED_EVENT_NAME, refresh);
    };
  }, []);

  function createPersonalEvent(input: Omit<ManagerPersonalEvent, "id" | "completedAt" | "createdAt" | "updatedAt">) {
    const timestamp = nowIso();
    const event: ManagerPersonalEvent = {
      ...input,
      id: makeId("manager_event"),
      completedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const next = [event, ...readPersonalEvents()].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    writePersonalEvents(next);
    setPersonalEvents(next);
    return event;
  }

  function updatePersonalEvent(id: string, patch: Partial<ManagerPersonalEvent>) {
    const next = readPersonalEvents()
      .map((event) => (event.id === id ? { ...event, ...patch, updatedAt: nowIso() } : event))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    writePersonalEvents(next);
    setPersonalEvents(next);
  }

  function removePersonalEvent(id: string) {
    const next = readPersonalEvents().filter((event) => event.id !== id);
    writePersonalEvents(next);
    setPersonalEvents(next);
  }

  function togglePersonalEventCompleted(id: string, completed: boolean) {
    updatePersonalEvent(id, { completedAt: completed ? nowIso() : null });
  }

  return { personalEvents, createPersonalEvent, updatePersonalEvent, removePersonalEvent, togglePersonalEventCompleted };
}

export function useManagerPreferences() {
  const [preferences, setPreferences] = useState<ManagerPreferences>(defaultPreferences);

  useEffect(() => {
    function refresh() {
      setPreferences(readPreferences());
    }
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(UPDATED_EVENT_NAME, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(UPDATED_EVENT_NAME, refresh);
    };
  }, []);

  function updatePreferences(patch: Partial<ManagerPreferences>) {
    const next = { ...readPreferences(), ...patch };
    writePreferences(next);
    setPreferences(next);
  }

  return { preferences, updatePreferences };
}

export function personalEventsToManagerSchedules(personalEvents: ManagerPersonalEvent[], now = new Date()): ManagerScheduleItem[] {
  return personalEvents
    .map((event) => ({
      id: `manager_personal_event:${event.id}`,
      kind: "schedule" as const,
      title: event.title,
      description: event.note || "個人予定",
      dueAt: event.date,
      urgency: classifyManagerDueDate(event.date, now),
      status: event.completedAt ? "completed" as const : "active" as const,
      startTime: event.startTime,
      endTime: event.endTime,
      source: {
        appKey: "manager" as const,
        sourceType: "personal_event" as const,
        sourceId: event.id,
        href: "/manager/personal-events"
      }
    }))
    .sort((a, b) => compareManagerItems(a, b, now));
}

function normalizePersonalEvent(event: ManagerPersonalEvent): ManagerPersonalEvent {
  return {
    ...event,
    completedAt: event.completedAt ?? null
  };
}
