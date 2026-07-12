"use client";

import { useEffect, useState } from "react";
import type { OrderApplication, OrderApplicationStatus, OrderMenu } from "./types";

const MENUS_KEY = "mikke.order.menus.v1";
const APPLICATIONS_KEY = "mikke.order.applications.v1";
const UPDATED_EVENT_NAME = "mikke-order:updated";

// Order MVPはlocalStorage保存のみ（Supabase/Activity Log接続は後続フェーズ）。
const mockOwnerProfileId = "local-owner";

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const seedMenus: OrderMenu[] = [
  {
    id: "menu_seed_1",
    ownerProfileId: mockOwnerProfileId,
    title: "はじめてのご相談",
    summary: "何を頼めばいいか分からない方向けの、まずは話を聞く相談枠です。",
    description: "困っていることを整理しながら、どんな依頼にできそうかを一緒に考えます。相談だけでも大丈夫です。",
    priceLabel: "一律",
    price: 0,
    leadTimeLabel: "相談後にご案内します",
    recommendedFor: "何から頼めばいいか分からない方",
    published: true,
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: "menu_seed_2",
    ownerProfileId: mockOwnerProfileId,
    title: "簡単な制作のご依頼",
    summary: "名刺やちょっとした資料など、小さな制作物のご依頼はこちら。",
    description: "内容に応じてお見積りをご案内します。まずはご希望の内容をお送りください。",
    priceLabel: "内容による",
    price: null,
    leadTimeLabel: "1〜2週間程度",
    recommendedFor: "小さな制作物を依頼したい方",
    published: true,
    createdAt: nowIso(),
    updatedAt: nowIso()
  }
];

function readMenus(): OrderMenu[] {
  if (typeof window === "undefined") return seedMenus;
  const raw = window.localStorage.getItem(MENUS_KEY);
  if (!raw) return seedMenus;
  try {
    const parsed = JSON.parse(raw) as OrderMenu[];
    return Array.isArray(parsed) ? parsed : seedMenus;
  } catch {
    return seedMenus;
  }
}

function writeMenus(menus: OrderMenu[]) {
  window.localStorage.setItem(MENUS_KEY, JSON.stringify(menus));
  window.dispatchEvent(new CustomEvent(UPDATED_EVENT_NAME));
}

function readApplications(): OrderApplication[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(APPLICATIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as OrderApplication[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeApplications(applications: OrderApplication[]) {
  window.localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(applications));
  window.dispatchEvent(new CustomEvent(UPDATED_EVENT_NAME));
}

export function useOrderMenus() {
  const [menus, setMenus] = useState<OrderMenu[]>(seedMenus);
  const [applications, setApplications] = useState<OrderApplication[]>([]);

  useEffect(() => {
    function refresh() {
      setMenus(readMenus());
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

  function createMenu(input: Omit<OrderMenu, "id" | "ownerProfileId" | "createdAt" | "updatedAt">) {
    const menu: OrderMenu = {
      ...input,
      id: makeId("menu"),
      ownerProfileId: mockOwnerProfileId,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    const next = [menu, ...readMenus()];
    writeMenus(next);
    setMenus(next);
    return menu;
  }

  function updateMenu(id: string, patch: Partial<OrderMenu>) {
    const next = readMenus().map((menu) => (menu.id === id ? { ...menu, ...patch, updatedAt: nowIso() } : menu));
    writeMenus(next);
    setMenus(next);
  }

  function createApplication(input: Omit<OrderApplication, "id" | "status" | "organizerMemo" | "deliveryNote" | "createdAt" | "updatedAt">) {
    const application: OrderApplication = {
      ...input,
      id: makeId("order_application"),
      status: "new",
      organizerMemo: "",
      deliveryNote: "",
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    const next = [application, ...readApplications()];
    writeApplications(next);
    setApplications(next);
    return application;
  }

  function updateApplication(id: string, patch: Partial<OrderApplication>) {
    const next = readApplications().map((application) =>
      application.id === id ? { ...application, ...patch, updatedAt: nowIso() } : application
    );
    writeApplications(next);
    setApplications(next);
  }

  function updateApplicationStatus(id: string, status: OrderApplicationStatus) {
    updateApplication(id, { status });
  }

  return { menus, applications, createMenu, updateMenu, createApplication, updateApplication, updateApplicationStatus };
}
