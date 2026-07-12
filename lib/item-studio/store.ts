"use client";

import { useEffect, useState } from "react";
import type { ChannelStatus, StudioChannel, StudioItem, StudioSale } from "./types";

const ITEMS_KEY = "mikke.item-studio.items.v1";
const CHANNELS_KEY = "mikke.item-studio.channels.v1";
const SALES_KEY = "mikke.item-studio.sales.v1";
const SKU_COUNTER_KEY = "mikke.item-studio.sku-counter.v1";
const UPDATED_EVENT_NAME = "mikke-item-studio:updated";

// Item Studio MVPはlocalStorage保存のみ（Supabase/Activity Log接続は後続フェーズ）。
const mockOwnerProfileId = "local-owner";

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nextSku(): string {
  if (typeof window === "undefined") return "1";
  const raw = window.localStorage.getItem(SKU_COUNTER_KEY);
  const next = raw ? Number(raw) + 1 : 1;
  window.localStorage.setItem(SKU_COUNTER_KEY, String(next));
  return String(next);
}

const seedItems: StudioItem[] = [
  {
    id: "item_seed_1",
    ownerProfileId: mockOwnerProfileId,
    sku: "1",
    title: "手編みのミニポーチ",
    category: "アクセサリー",
    color: "ベージュ",
    material: "コットン",
    condition: "",
    price: 2800,
    cost: 900,
    stock: 3,
    description: "小さな刺繍を添えた、手編みのミニポーチです。",
    photoUrl: "",
    published: true,
    createdAt: nowIso(),
    updatedAt: nowIso()
  }
];

const seedChannels: StudioChannel[] = [
  {
    id: "channel_seed_1",
    itemId: "item_seed_1",
    channelName: "minne",
    status: "listed",
    url: "",
    memo: "",
    createdAt: nowIso(),
    updatedAt: nowIso()
  }
];

function readItems(): StudioItem[] {
  if (typeof window === "undefined") return seedItems;
  const raw = window.localStorage.getItem(ITEMS_KEY);
  if (!raw) return seedItems;
  try {
    const parsed = JSON.parse(raw) as StudioItem[];
    return Array.isArray(parsed) ? parsed : seedItems;
  } catch {
    return seedItems;
  }
}

function writeItems(items: StudioItem[]) {
  window.localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(UPDATED_EVENT_NAME));
}

function readChannels(): StudioChannel[] {
  if (typeof window === "undefined") return seedChannels;
  const raw = window.localStorage.getItem(CHANNELS_KEY);
  if (!raw) return seedChannels;
  try {
    const parsed = JSON.parse(raw) as StudioChannel[];
    return Array.isArray(parsed) ? parsed : seedChannels;
  } catch {
    return seedChannels;
  }
}

function writeChannels(channels: StudioChannel[]) {
  window.localStorage.setItem(CHANNELS_KEY, JSON.stringify(channels));
  window.dispatchEvent(new CustomEvent(UPDATED_EVENT_NAME));
}

function readSales(): StudioSale[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(SALES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StudioSale[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSales(sales: StudioSale[]) {
  window.localStorage.setItem(SALES_KEY, JSON.stringify(sales));
  window.dispatchEvent(new CustomEvent(UPDATED_EVENT_NAME));
}

export function useItemStudio() {
  const [items, setItems] = useState<StudioItem[]>(seedItems);
  const [channels, setChannels] = useState<StudioChannel[]>(seedChannels);
  const [sales, setSales] = useState<StudioSale[]>([]);

  useEffect(() => {
    function refresh() {
      setItems(readItems());
      setChannels(readChannels());
      setSales(readSales());
    }
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(UPDATED_EVENT_NAME, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(UPDATED_EVENT_NAME, refresh);
    };
  }, []);

  function createItem(input: Omit<StudioItem, "id" | "ownerProfileId" | "sku" | "createdAt" | "updatedAt">) {
    const item: StudioItem = {
      ...input,
      id: makeId("item"),
      ownerProfileId: mockOwnerProfileId,
      sku: nextSku(),
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    const next = [item, ...readItems()];
    writeItems(next);
    setItems(next);
    return item;
  }

  function updateItem(id: string, patch: Partial<StudioItem>) {
    const next = readItems().map((item) => (item.id === id ? { ...item, ...patch, updatedAt: nowIso() } : item));
    writeItems(next);
    setItems(next);
  }

  function addChannel(itemId: string, channelName: string) {
    const channel: StudioChannel = {
      id: makeId("channel"),
      itemId,
      channelName,
      status: "not_listed",
      url: "",
      memo: "",
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    const next = [...readChannels(), channel];
    writeChannels(next);
    setChannels(next);
    return channel;
  }

  function updateChannel(id: string, patch: Partial<StudioChannel>) {
    const next = readChannels().map((channel) => (channel.id === id ? { ...channel, ...patch, updatedAt: nowIso() } : channel));
    writeChannels(next);
    setChannels(next);
  }

  function updateChannelStatus(id: string, status: ChannelStatus) {
    updateChannel(id, { status });
  }

  function removeChannel(id: string) {
    const next = readChannels().filter((channel) => channel.id !== id);
    writeChannels(next);
    setChannels(next);
  }

  function addSale(input: Omit<StudioSale, "id" | "createdAt">) {
    const sale: StudioSale = { ...input, id: makeId("sale"), createdAt: nowIso() };
    const next = [sale, ...readSales()];
    writeSales(next);
    setSales(next);
    return sale;
  }

  return { items, channels, sales, createItem, updateItem, addChannel, updateChannel, updateChannelStatus, removeChannel, addSale };
}
