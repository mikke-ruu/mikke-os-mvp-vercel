"use client";

import { useEffect, useState } from "react";
import type {
  FundPlan,
  FundPlanInput,
  FundProject,
  FundProjectInput,
  FundSupport,
  FundSupportInput,
  FundSupportSummary,
  FundUpdate,
  FundUpdateInput
} from "./types";

const PROJECTS_KEY = "mikke.fund.projects.v1";
const PLANS_KEY = "mikke.fund.plans.v1";
const SUPPORTS_KEY = "mikke.fund.supports.v1";
const UPDATES_KEY = "mikke.fund.updates.v1";
const UPDATED_EVENT_NAME = "mikke-fund:updated";
const mockOwnerProfileId = "local-owner";

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function dateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const seedProject: FundProject = {
  id: "fund_project_seed_1",
  ownerProfileId: mockOwnerProfileId,
  profileSlug: "ayumi",
  slug: "new-course",
  title: "新しい認定講座を一緒につくりたい",
  shortDescription: "最初の受講生と一緒に、実践しやすい講座と教材を形にするプロジェクトです。",
  description: "少人数のトライアル講座から始め、参加者の声を取り入れながら正式な講座へ育てます。",
  projectType: "course",
  campaignType: "early_application",
  stage: "campaign",
  status: "open",
  visibility: "public",
  coverImageUrl: "",
  goalType: "participants",
  goalValue: 10,
  currentValue: 0,
  displayAmount: false,
  startAt: dateAfter(-7),
  endAt: dateAfter(30),
  externalPaymentUrl: "",
  externalApplicationUrl: "https://example.com/application",
  whyNow: "講座の骨組みができ、実際に学ぶ方の声を受け取れる段階になったためです。",
  audience: "新しい活動を始めたい方、学びを仕事につなげたい方。",
  useOfSupport: "教材、動画、トライアル用キットの制作に使います。",
  schedule: "募集後に日程を調整し、少人数のトライアル講座を開催します。",
  riskNotes: "内容や開催日は、参加状況に応じて相談のうえ変更する場合があります。",
  cancellationPolicy: "延期・中止時の連絡と返金は、実行者が外部申込先を通じて対応します。",
  contactNote: "お問い合わせはStoryの連絡先からお願いします。",
  publishedAt: nowIso(),
  completedAt: null,
  archivedAt: null,
  createdAt: nowIso(),
  updatedAt: nowIso()
};

const seedPlan: FundPlan = {
  id: "fund_plan_seed_1",
  projectId: seedProject.id,
  title: "トライアルメンバー",
  description: "正式公開前の講座を受講し、感想や改善点を一緒に考えるプランです。",
  imageUrl: "",
  planType: "early_application",
  price: 50000,
  quantityLimit: 10,
  perPersonLimit: 1,
  deliveryDate: dateAfter(60),
  externalPaymentUrl: "",
  externalApplicationUrl: "https://example.com/application",
  requiredInformationNote: "申込先で氏名と連絡先をご入力ください。",
  requiresShipping: false,
  status: "active",
  sortOrder: 0,
  createdAt: nowIso(),
  updatedAt: nowIso()
};

function readList<T>(key: string, fallback: T[]) {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function readProjects() {
  return readList(PROJECTS_KEY, [seedProject]);
}

function readPlans() {
  return readList(PLANS_KEY, [seedPlan]);
}

function readSupports() {
  return readList<FundSupport>(SUPPORTS_KEY, []);
}

function readUpdates() {
  return readList<FundUpdate>(UPDATES_KEY, []);
}

function writeList<T>(key: string, value: T[]) {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(UPDATED_EVENT_NAME));
}

export function useFundProjects() {
  const [projects, setProjects] = useState<FundProject[]>([seedProject]);
  const [plans, setPlans] = useState<FundPlan[]>([seedPlan]);
  const [supports, setSupports] = useState<FundSupport[]>([]);
  const [updates, setUpdates] = useState<FundUpdate[]>([]);

  useEffect(() => {
    function refresh() {
      setProjects(readProjects());
      setPlans(readPlans());
      setSupports(readSupports());
      setUpdates(readUpdates());
    }
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(UPDATED_EVENT_NAME, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(UPDATED_EVENT_NAME, refresh);
    };
  }, []);

  function createProject(input: FundProjectInput) {
    const timestamp = nowIso();
    const project: FundProject = {
      ...input,
      id: makeId("fund_project"),
      ownerProfileId: mockOwnerProfileId,
      currentValue: 0,
      publishedAt: input.visibility !== "private" && input.status !== "draft" ? timestamp : null,
      completedAt: input.status === "completed" ? timestamp : null,
      archivedAt: input.status === "archived" ? timestamp : null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const next = [project, ...readProjects()];
    writeList(PROJECTS_KEY, next);
    setProjects(next);
    return project;
  }

  function updateProject(id: string, patch: Partial<FundProject>) {
    const timestamp = nowIso();
    const next = readProjects().map((project) => {
      if (project.id !== id) return project;
      const updated = { ...project, ...patch, updatedAt: timestamp };
      if (!updated.publishedAt && updated.visibility !== "private" && updated.status !== "draft") updated.publishedAt = timestamp;
      if (!updated.completedAt && updated.status === "completed") updated.completedAt = timestamp;
      if (!updated.archivedAt && updated.status === "archived") updated.archivedAt = timestamp;
      return updated;
    });
    writeList(PROJECTS_KEY, next);
    setProjects(next);
  }

  function replaceProjectPlans(projectId: string, inputs: FundPlanInput[]) {
    const timestamp = nowIso();
    const existing = readPlans();
    const kept = existing.filter((plan) => plan.projectId !== projectId);
    const nextForProject = inputs.map<FundPlan>((input, index) => {
      const previous = input.id ? existing.find((plan) => plan.id === input.id && plan.projectId === projectId) : undefined;
      return {
        ...input,
        id: previous?.id ?? makeId("fund_plan"),
        projectId,
        sortOrder: index,
        createdAt: previous?.createdAt ?? timestamp,
        updatedAt: timestamp
      };
    });
    const next = [...kept, ...nextForProject];
    writeList(PLANS_KEY, next);
    setPlans(next);
  }

  function createSupport(input: FundSupportInput) {
    const timestamp = nowIso();
    const support: FundSupport = {
      ...input,
      id: makeId("fund_support"),
      supporterUserId: "",
      completedAt: input.fulfillmentStatus === "completed" ? timestamp : null,
      cancelledAt: input.paymentStatus === "cancelled" ? timestamp : null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const next = [support, ...readSupports()];
    writeList(SUPPORTS_KEY, next);
    setSupports(next);
    return support;
  }

  function updateSupport(id: string, patch: Partial<FundSupport>) {
    const timestamp = nowIso();
    const next = readSupports().map((support) => {
      if (support.id !== id) return support;
      const updated = { ...support, ...patch, updatedAt: timestamp };
      updated.completedAt = updated.fulfillmentStatus === "completed" ? updated.completedAt ?? timestamp : null;
      updated.cancelledAt = updated.paymentStatus === "cancelled" ? updated.cancelledAt ?? timestamp : null;
      return updated;
    });
    writeList(SUPPORTS_KEY, next);
    setSupports(next);
  }

  function createUpdate(input: FundUpdateInput) {
    const timestamp = nowIso();
    const update: FundUpdate = {
      ...input,
      id: makeId("fund_update"),
      publishedAt: input.visibility === "public" ? timestamp : null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const next = [update, ...readUpdates()];
    writeList(UPDATES_KEY, next);
    setUpdates(next);
    return update;
  }

  function updateFundUpdate(id: string, patch: Partial<FundUpdate>) {
    const timestamp = nowIso();
    const next = readUpdates().map((update) => {
      if (update.id !== id) return update;
      const updated = { ...update, ...patch, updatedAt: timestamp };
      if (!updated.publishedAt && updated.visibility === "public") updated.publishedAt = timestamp;
      return updated;
    });
    writeList(UPDATES_KEY, next);
    setUpdates(next);
  }

  const projectsWithProgress = projects.map((project) => ({
    ...project,
    currentValue: currentValueForProject(project, summarizeFundSupports(supports.filter((support) => support.projectId === project.id)))
  }));

  return {
    projects: projectsWithProgress,
    plans,
    supports,
    updates,
    createProject,
    updateProject,
    replaceProjectPlans,
    createSupport,
    updateSupport,
    createUpdate,
    updateFundUpdate
  };
}

export function canViewFundProject(project: FundProject) {
  return project.visibility !== "private" && project.status !== "draft";
}

export function summarizeFundSupports(supports: FundSupport[]): FundSupportSummary {
  const valid = supports.filter(
    (support) =>
      support.recordStatus === "valid" &&
      support.paymentStatus !== "refunded" &&
      support.paymentStatus !== "cancelled" &&
      support.fulfillmentStatus !== "cancelled"
  );
  const supporterKeys = new Set(
    valid.map((support) =>
      (support.supporterUserId || support.supporterEmail || support.supporterName).trim().toLowerCase()
    ).filter(Boolean)
  );

  return {
    supporterCount: supporterKeys.size,
    supportCount: valid.length,
    quantity: valid.reduce((sum, support) => sum + Math.max(1, support.quantity), 0),
    confirmedAmount: valid.reduce((sum, support) => sum + (support.paymentStatus === "confirmed" ? support.amount ?? 0 : 0), 0),
    completedCount: valid.filter((support) => support.fulfillmentStatus === "completed").length
  };
}

function currentValueForProject(project: FundProject, summary: FundSupportSummary) {
  if (project.goalType === "amount") return summary.confirmedAmount;
  if (project.goalType === "supporters") return summary.supporterCount;
  return summary.quantity;
}
