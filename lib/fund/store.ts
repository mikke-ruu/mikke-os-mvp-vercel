"use client";

import { useEffect, useState } from "react";
import type {
  FundPlan,
  FundPlanInput,
  FundAppLink,
  FundChallengeRecord,
  FundChallengeRecordInput,
  FundProject,
  FundProjectInput,
  FundSupport,
  FundSupportInput,
  FundSupportSummary,
  FundUpdate,
  FundTargetService,
  FundUpdateInput
} from "./types";

const PROJECTS_KEY = "mikke.fund.projects.v1";
const PLANS_KEY = "mikke.fund.plans.v1";
const SUPPORTS_KEY = "mikke.fund.supports.v1";
const UPDATES_KEY = "mikke.fund.updates.v1";
const CHALLENGE_RECORDS_KEY = "mikke.fund.challenge-records.v1";
const APP_LINKS_KEY = "mikke.fund.app-links.v1";
const UPDATED_EVENT_NAME = "mikke-fund:updated";
const mockOwnerProfileId = "local-owner";

function ownerProjectsKey(ownerProfileId: string) {
  return `mikke.fund.owner-projects.v2.${ownerProfileId}`;
}

function ownerPlansKey(ownerProfileId: string) {
  return `mikke.fund.owner-plans.v2.${ownerProfileId}`;
}

function ownerUpdatesKey(ownerProfileId: string) {
  return `mikke.fund.owner-updates.v2.${ownerProfileId}`;
}

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

function readProjects(ownerProfileId?: string) {
  return ownerProfileId ? readList<FundProject>(ownerProjectsKey(ownerProfileId), []) : readList(PROJECTS_KEY, [seedProject]);
}

function readPlans(ownerProfileId?: string) {
  return ownerProfileId ? readList<FundPlan>(ownerPlansKey(ownerProfileId), []) : readList(PLANS_KEY, [seedPlan]);
}

function readSupports() {
  return readList<FundSupport>(SUPPORTS_KEY, []);
}

function readUpdates(ownerProfileId?: string) {
  return ownerProfileId ? readList<FundUpdate>(ownerUpdatesKey(ownerProfileId), []) : readList<FundUpdate>(UPDATES_KEY, []);
}

function readChallengeRecords() {
  return readList<FundChallengeRecord>(CHALLENGE_RECORDS_KEY, []);
}

function readAppLinks() {
  return readList<FundAppLink>(APP_LINKS_KEY, []);
}

function writeList<T>(key: string, value: T[]) {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(UPDATED_EVENT_NAME));
}

export function getLegacyFundContentForMigration() {
  if (typeof window === "undefined") return null;
  const rawProjects = window.localStorage.getItem(PROJECTS_KEY);
  if (!rawProjects) return null;

  try {
    const projects = JSON.parse(rawProjects) as FundProject[];
    const rawPlans = window.localStorage.getItem(PLANS_KEY);
    const plans = rawPlans ? JSON.parse(rawPlans) as FundPlan[] : [];
    if (!Array.isArray(projects) || !Array.isArray(plans)) return null;
    return { projects, plans };
  } catch {
    return null;
  }
}

export function getLegacyFundUpdatesForMigration() {
  if (typeof window === "undefined") return null;
  const rawUpdates = window.localStorage.getItem(UPDATES_KEY);
  if (!rawUpdates) return null;

  try {
    const updates = JSON.parse(rawUpdates) as FundUpdate[];
    return Array.isArray(updates) ? updates : null;
  } catch {
    return null;
  }
}

export function cacheOwnerFundContent(ownerProfileId: string, projects: FundProject[], plans: FundPlan[], updates: FundUpdate[]) {
  if (typeof window === "undefined") return;
  writeList(ownerProjectsKey(ownerProfileId), projects);
  writeList(ownerPlansKey(ownerProfileId), plans);
  writeList(ownerUpdatesKey(ownerProfileId), updates);
}

export function useFundProjects(ownerProfileId?: string) {
  const [projects, setProjects] = useState<FundProject[]>(ownerProfileId ? [] : [seedProject]);
  const [plans, setPlans] = useState<FundPlan[]>(ownerProfileId ? [] : [seedPlan]);
  const [supports, setSupports] = useState<FundSupport[]>([]);
  const [updates, setUpdates] = useState<FundUpdate[]>([]);
  const [challengeRecords, setChallengeRecords] = useState<FundChallengeRecord[]>([]);
  const [appLinks, setAppLinks] = useState<FundAppLink[]>([]);

  useEffect(() => {
    function refresh() {
      setProjects(readProjects(ownerProfileId));
      setPlans(readPlans(ownerProfileId));
      setSupports(readSupports());
      setUpdates(readUpdates(ownerProfileId));
      setChallengeRecords(readChallengeRecords());
      setAppLinks(readAppLinks());
    }
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(UPDATED_EVENT_NAME, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(UPDATED_EVENT_NAME, refresh);
    };
  }, [ownerProfileId]);

  function prepareProject(input: FundProjectInput, existing?: FundProject) {
    const timestamp = nowIso();
    return {
      ...existing,
      ...input,
      id: existing?.id ?? makeId("fund_project"),
      ownerProfileId: existing?.ownerProfileId ?? ownerProfileId ?? mockOwnerProfileId,
      currentValue: existing?.currentValue ?? 0,
      publishedAt: existing?.publishedAt ?? (input.visibility !== "private" && input.status !== "draft" ? timestamp : null),
      completedAt: existing?.completedAt ?? (input.status === "completed" ? timestamp : null),
      archivedAt: existing?.archivedAt ?? (input.status === "archived" ? timestamp : null),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    } satisfies FundProject;
  }

  function saveProject(project: FundProject) {
    const next = [project, ...readProjects(ownerProfileId).filter((item) => item.id !== project.id)];
    writeList(ownerProfileId ? ownerProjectsKey(ownerProfileId) : PROJECTS_KEY, next);
    setProjects(next);
  }

  function createProject(input: FundProjectInput) {
    const project = prepareProject(input);
    saveProject(project);
    return project;
  }

  function updateProject(id: string, patch: Partial<FundProject>) {
    const timestamp = nowIso();
    let savedProject: FundProject | null = null;
    const next = readProjects(ownerProfileId).map((project) => {
      if (project.id !== id) return project;
      const updated = { ...project, ...patch, updatedAt: timestamp };
      if (!updated.publishedAt && updated.visibility !== "private" && updated.status !== "draft") updated.publishedAt = timestamp;
      if (!updated.completedAt && updated.status === "completed") updated.completedAt = timestamp;
      if (!updated.archivedAt && updated.status === "archived") updated.archivedAt = timestamp;
      savedProject = updated;
      return updated;
    });
    writeList(ownerProfileId ? ownerProjectsKey(ownerProfileId) : PROJECTS_KEY, next);
    setProjects(next);
    return savedProject;
  }

  function prepareProjectPlans(projectId: string, inputs: FundPlanInput[]) {
    const timestamp = nowIso();
    const existing = readPlans(ownerProfileId);
    return inputs.map<FundPlan>((input, index) => {
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
  }

  function saveProjectPlans(projectId: string, projectPlans: FundPlan[]) {
    const next = [...readPlans(ownerProfileId).filter((plan) => plan.projectId !== projectId), ...projectPlans];
    writeList(ownerProfileId ? ownerPlansKey(ownerProfileId) : PLANS_KEY, next);
    setPlans(next);
  }

  function replaceProjectPlans(projectId: string, inputs: FundPlanInput[]) {
    const projectPlans = prepareProjectPlans(projectId, inputs);
    saveProjectPlans(projectId, projectPlans);
    return projectPlans;
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
    const next = [update, ...readUpdates(ownerProfileId)];
    writeList(ownerProfileId ? ownerUpdatesKey(ownerProfileId) : UPDATES_KEY, next);
    setUpdates(next);
    return update;
  }

  function updateFundUpdate(id: string, patch: Partial<FundUpdate>) {
    const timestamp = nowIso();
    const next = readUpdates(ownerProfileId).map((update) => {
      if (update.id !== id) return update;
      const updated = { ...update, ...patch, updatedAt: timestamp };
      if (!updated.publishedAt && updated.visibility === "public") updated.publishedAt = timestamp;
      return updated;
    });
    writeList(ownerProfileId ? ownerUpdatesKey(ownerProfileId) : UPDATES_KEY, next);
    setUpdates(next);
  }

  function saveChallengeRecord(input: FundChallengeRecordInput) {
    const timestamp = nowIso();
    const existing = readChallengeRecords().find((record) => record.projectId === input.projectId);
    const record: FundChallengeRecord = {
      ...input,
      id: existing?.id ?? makeId("fund_challenge"),
      publishedAt: input.visibility === "public" ? existing?.publishedAt ?? timestamp : null,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    };
    const next = [record, ...readChallengeRecords().filter((item) => item.projectId !== input.projectId)];
    writeList(CHALLENGE_RECORDS_KEY, next);
    setChallengeRecords(next);
    return record;
  }

  function saveAppLinks(projectId: string, targets: FundTargetService[]) {
    const timestamp = nowIso();
    const existing = readAppLinks();
    const existingForProject = existing.filter((link) => link.projectId === projectId);
    const targetSet = new Set(targets);
    const nextForProject = (Object.keys(fundTargetKeys) as FundTargetService[]).map<FundAppLink>((targetService) => {
      const previous = existingForProject.find((link) => link.targetService === targetService);
      return {
        id: previous?.id ?? makeId("fund_app_link"),
        projectId,
        targetService,
        linkStatus: targetSet.has(targetService) ? "ready" : "cancelled",
        createdAt: previous?.createdAt ?? timestamp,
        updatedAt: timestamp
      };
    });
    const next = [...existing.filter((link) => link.projectId !== projectId), ...nextForProject];
    writeList(APP_LINKS_KEY, next);
    setAppLinks(next);
    return nextForProject;
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
    challengeRecords,
    appLinks,
    prepareProject,
    saveProject,
    prepareProjectPlans,
    saveProjectPlans,
    createProject,
    updateProject,
    replaceProjectPlans,
    createSupport,
    updateSupport,
    createUpdate,
    updateFundUpdate,
    saveChallengeRecord,
    saveAppLinks
  };
}

const fundTargetKeys: Record<FundTargetService, true> = {
  order: true,
  item_studio: true,
  event: true,
  session: true,
  academy: true,
  community: true,
  team_works: true
};

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
