import { supabase } from "@/lib/supabase/client";
import type { FundChallengeRecord, FundPlan, FundProject, FundUpdate } from "./types";

type PublicProjectRow = {
  project_id: string;
  owner_profile_id: string;
  profile_slug: string;
  slug: string;
  title: string;
  short_description: string;
  description: string;
  project_type: FundProject["projectType"];
  campaign_type: FundProject["campaignType"];
  stage: FundProject["stage"];
  status: FundProject["status"];
  cover_image_url: string;
  goal_type: FundProject["goalType"];
  goal_value: number;
  current_value: number;
  display_amount: boolean;
  start_at: string | null;
  end_at: string | null;
  external_payment_url: string;
  external_application_url: string;
  why_now: string;
  audience: string;
  use_of_support: string;
  schedule: string;
  risk_notes: string;
  cancellation_policy: string;
  contact_note: string;
  published_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type PublicPlanRow = {
  plan_id: string;
  project_id: string;
  title: string;
  description: string;
  image_url: string;
  plan_type: FundPlan["planType"];
  price: number | null;
  quantity_limit: number | null;
  per_person_limit: number | null;
  delivery_date: string | null;
  external_payment_url: string;
  external_application_url: string;
  status: FundPlan["status"];
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type PublicUpdateRow = {
  update_id: string;
  project_id: string;
  title: string;
  body: string;
  image_url: string;
  published_at: string;
  created_at: string;
  updated_at: string;
};

type PublicChallengeRecordRow = {
  challenge_record_id: string;
  project_id: string;
  title: string;
  summary: string;
  outcome: string;
  image_url: string;
  story_enabled: boolean;
  completed_at: string;
  published_at: string;
  updated_at: string;
};

const publicProjectColumns = "project_id, owner_profile_id, profile_slug, slug, title, short_description, description, project_type, campaign_type, stage, status, cover_image_url, goal_type, goal_value, current_value, display_amount, start_at, end_at, external_payment_url, external_application_url, why_now, audience, use_of_support, schedule, risk_notes, cancellation_policy, contact_note, published_at, completed_at, created_at, updated_at";
const publicPlanColumns = "plan_id, project_id, title, description, image_url, plan_type, price, quantity_limit, per_person_limit, delivery_date, external_payment_url, external_application_url, status, sort_order, created_at, updated_at";
const publicUpdateColumns = "update_id, project_id, title, body, image_url, published_at, created_at, updated_at";
const publicChallengeRecordColumns = "challenge_record_id, project_id, title, summary, outcome, image_url, story_enabled, completed_at, published_at, updated_at";

export async function getPublicFundProject(profileSlug: string, projectSlug: string) {
  const { data: project, error: projectError } = await supabase
    .from("fund_public_projects")
    .select(publicProjectColumns)
    .eq("profile_slug", profileSlug)
    .eq("slug", projectSlug)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) return null;

  const [plansResult, updatesResult, challengeRecordResult] = await Promise.all([
    supabase
      .from("fund_public_plans")
      .select(publicPlanColumns)
      .eq("project_id", project.project_id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("fund_public_updates")
      .select(publicUpdateColumns)
      .eq("project_id", project.project_id)
      .order("published_at", { ascending: false }),
    supabase
      .from("fund_public_challenge_records")
      .select(publicChallengeRecordColumns)
      .eq("project_id", project.project_id)
      .maybeSingle()
  ]);

  const { data: plans, error: plansError } = plansResult;
  if (plansError) throw plansError;
  const { data: updates, error: updatesError } = updatesResult;
  if (updatesError) throw updatesError;
  const { data: challengeRecord, error: challengeRecordError } = challengeRecordResult;
  if (challengeRecordError) throw challengeRecordError;

  return {
    project: mapPublicProject(project as unknown as PublicProjectRow),
    plans: (plans ?? []).map((plan) => mapPublicPlan(plan as unknown as PublicPlanRow)),
    updates: (updates ?? []).map((update) => mapPublicUpdate(update as unknown as PublicUpdateRow)),
    challengeRecord: challengeRecord
      ? mapPublicChallengeRecord(challengeRecord as unknown as PublicChallengeRecordRow)
      : undefined
  };
}

export async function getPublicFundProjects(profileSlug: string) {
  const { data, error } = await supabase
    .from("fund_public_projects")
    .select(publicProjectColumns)
    .eq("profile_slug", profileSlug)
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((project) => mapPublicProject(project as unknown as PublicProjectRow));
}

function mapPublicProject(row: PublicProjectRow): FundProject {
  return {
    id: row.project_id,
    ownerProfileId: row.owner_profile_id,
    profileSlug: row.profile_slug,
    slug: row.slug,
    title: row.title,
    shortDescription: row.short_description,
    description: row.description,
    projectType: row.project_type,
    campaignType: row.campaign_type,
    stage: row.stage,
    status: row.status,
    visibility: "public",
    coverImageUrl: row.cover_image_url,
    goalType: row.goal_type,
    goalValue: Number(row.goal_value),
    currentValue: Number(row.current_value),
    displayAmount: row.display_amount,
    startAt: row.start_at ?? "",
    endAt: row.end_at ?? "",
    externalPaymentUrl: row.external_payment_url,
    externalApplicationUrl: row.external_application_url,
    whyNow: row.why_now,
    audience: row.audience,
    useOfSupport: row.use_of_support,
    schedule: row.schedule,
    riskNotes: row.risk_notes,
    cancellationPolicy: row.cancellation_policy,
    contactNote: row.contact_note,
    publishedAt: row.published_at,
    completedAt: row.completed_at,
    archivedAt: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPublicPlan(row: PublicPlanRow): FundPlan {
  return {
    id: row.plan_id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    planType: row.plan_type,
    price: row.price == null ? null : Number(row.price),
    quantityLimit: row.quantity_limit,
    perPersonLimit: row.per_person_limit,
    deliveryDate: row.delivery_date ?? "",
    externalPaymentUrl: row.external_payment_url,
    externalApplicationUrl: row.external_application_url,
    requiredInformationNote: "",
    requiresShipping: false,
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPublicUpdate(row: PublicUpdateRow): FundUpdate {
  return {
    id: row.update_id,
    projectId: row.project_id,
    title: row.title,
    body: row.body,
    imageUrl: row.image_url,
    visibility: "public",
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPublicChallengeRecord(row: PublicChallengeRecordRow): FundChallengeRecord {
  return {
    id: row.challenge_record_id,
    projectId: row.project_id,
    title: row.title,
    summary: row.summary,
    outcome: row.outcome,
    imageUrl: row.image_url,
    visibility: "public",
    storyEnabled: row.story_enabled,
    completedAt: row.completed_at,
    publishedAt: row.published_at,
    createdAt: row.published_at,
    updatedAt: row.updated_at
  };
}
