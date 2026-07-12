"use client";

import { useEffect, useState } from "react";
import type { SessionBooking, SessionBookingStatus, SessionMenu } from "./types";

const MENUS_KEY = "mikke.session.menus.v1";
const BOOKINGS_KEY = "mikke.session.bookings.v1";
const UPDATED_EVENT_NAME = "mikke-session:updated";

// Session MVPはlocalStorage保存のみ（Supabase/Activity Log接続は後続フェーズ）。
const mockOwnerProfileId = "local-owner";

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const seedMenus: SessionMenu[] = [
  {
    id: "session_menu_seed_1",
    ownerProfileId: mockOwnerProfileId,
    title: "60分の個別相談",
    summary: "活動の悩みや今後の進め方について、じっくりお話しします。",
    description: "オンライン・対面どちらも対応可能です。ご希望の日時をお知らせください。",
    durationLabel: "60分",
    priceLabel: "一律",
    price: 5000,
    availabilityNote: "平日10:00〜17:00の間でご相談ください",
    published: true,
    createdAt: nowIso(),
    updatedAt: nowIso()
  }
];

function readMenus(): SessionMenu[] {
  if (typeof window === "undefined") return seedMenus;
  const raw = window.localStorage.getItem(MENUS_KEY);
  if (!raw) return seedMenus;
  try {
    const parsed = JSON.parse(raw) as SessionMenu[];
    return Array.isArray(parsed) ? parsed : seedMenus;
  } catch {
    return seedMenus;
  }
}

function writeMenus(menus: SessionMenu[]) {
  window.localStorage.setItem(MENUS_KEY, JSON.stringify(menus));
  window.dispatchEvent(new CustomEvent(UPDATED_EVENT_NAME));
}

function readBookings(): SessionBooking[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(BOOKINGS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SessionBooking[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBookings(bookings: SessionBooking[]) {
  window.localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
  window.dispatchEvent(new CustomEvent(UPDATED_EVENT_NAME));
}

export function useSessionMenus() {
  const [menus, setMenus] = useState<SessionMenu[]>(seedMenus);
  const [bookings, setBookings] = useState<SessionBooking[]>([]);

  useEffect(() => {
    function refresh() {
      setMenus(readMenus());
      setBookings(readBookings());
    }
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(UPDATED_EVENT_NAME, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(UPDATED_EVENT_NAME, refresh);
    };
  }, []);

  function createMenu(input: Omit<SessionMenu, "id" | "ownerProfileId" | "createdAt" | "updatedAt">) {
    const menu: SessionMenu = {
      ...input,
      id: makeId("session_menu"),
      ownerProfileId: mockOwnerProfileId,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    const next = [menu, ...readMenus()];
    writeMenus(next);
    setMenus(next);
    return menu;
  }

  function updateMenu(id: string, patch: Partial<SessionMenu>) {
    const next = readMenus().map((menu) => (menu.id === id ? { ...menu, ...patch, updatedAt: nowIso() } : menu));
    writeMenus(next);
    setMenus(next);
  }

  function createBooking(input: Omit<SessionBooking, "id" | "status" | "organizerMemo" | "createdAt" | "updatedAt">) {
    const booking: SessionBooking = {
      ...input,
      id: makeId("session_booking"),
      status: "requested",
      organizerMemo: "",
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    const next = [booking, ...readBookings()];
    writeBookings(next);
    setBookings(next);
    return booking;
  }

  function updateBooking(id: string, patch: Partial<SessionBooking>) {
    const next = readBookings().map((booking) => (booking.id === id ? { ...booking, ...patch, updatedAt: nowIso() } : booking));
    writeBookings(next);
    setBookings(next);
  }

  function updateBookingStatus(id: string, status: SessionBookingStatus) {
    updateBooking(id, { status });
  }

  return { menus, bookings, createMenu, updateMenu, createBooking, updateBooking, updateBookingStatus };
}
