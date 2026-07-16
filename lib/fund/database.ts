import { supabase } from "@/lib/supabase/client";
import type { FundPlan, FundProject } from "./types";

export const FUND_DATABASE_UPDATED_EVENT = "mikke-fund:database-updated";

export function notifyFundDatabaseUpdated(ownerProfileId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FUND_DATABASE_UPDATED_EVENT, { detail: { ownerProfileId } }));
}

type OwnerFundProjectRow = {
  id: string;
  owner_profile_id: string;
  source_local_id: string;
  slug: string;
  title: string;
  short_description: string;
  description: string;
  project_type: FundProject["projectType"];
  campaign_type: FundProject["campaignType"];
  stage: FundProject["stage"];
  status: FundProject["status"];
  visibility: FundProject["visibility"];
  cover_image_url: string;
  goal_type: FundProject["goalType"];
  goal_value: number;
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
  published_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type OwnerFundPlanRow = {
  source_local_id: string;
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
  required_information_note: string;
  requires_shipping: boolean;
  status: FundPlan["status"];
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const ownerProjectColumns = `
  id, owner_profile_id, source_local_id, slug, title, short_description,
  description, project_type, campaign_type, stage, status, visibility,
  cover_image_url, goal_type, goal_value, display_amount, start_at, end_at,
  external_payment_url, external_application_url, why_now, audience,
  use_of_support, schedule, risk_notes, cancellation_policy, contact_note,
  published_at, completed_at, archived_at, created_at, updated_at
`;

const ownerPlanColumns = `
  source_local_id, project_id, title, description, image_url, plan_type,
  price, quantity_limit, per_person_limit, delivery_date,
  external_payment_url, external_application_url, required_information_note,
  requires_shipping, status, sort_order, created_at, updated_at
`;

export async function saveFundProjectContent(input: {
  ownerProfileId: string;
  project: FundProject;
  plans: FundPlan[];
}) {
  const { data, error } = await supabase.rpc("save_fund_project_content", {
    p_owner_profile_id: input.ownerProfileId,
    p_project: input.project,
    p_plans: input.plans
  });
  if (error) throw error;
  return data as string;
}

export async function getOwnerFundContent(ownerProfileId: string, profileSlug: string) {
  const { data: projectData, error: projectError } = await supabase
    .from("fund_projects")
    .select(ownerProjectColumns)
    .eq("owner_profile_id", ownerProfileId)
    .order("updated_at", { ascending: false });

  if (projectError) throw projectError;

  const projectRows = (projectData ?? []) as unknown as OwnerFundProjectRow[];
  const databaseProjectIds = projectRows.map((project) => project.id);
  let planRows: OwnerFundPlanRow[] = [];

  if (databaseProjectIds.length > 0) {
    const { data: planData, error: planError } = await supabase
      .from("fund_plans")
      .select(ownerPlanColumns)
      .in("project_id", databaseProjectIds)
      .order("sort_order", { ascending: true });

    if (planError) throw planError;
    planRows = (planData ?? []) as unknown as OwnerFundPlanRow[];
  }

  const sourceIdByDatabaseId = new Map(projectRows.map((project) => [project.id, project.source_local_id]));

  return {
    projects: projectRows.map<FundProject>((project) => ({
      id: project.source_local_id,
      ownerProfileId: project.owner_profile_id,
      profileSlug,
      slug: project.slug,
      title: project.title,
      shortDescription: project.short_description,
      description: project.description,
      projectType: project.project_type,
      campaignType: project.campaign_type,
      stage: project.stage,
      status: project.status,
      visibility: project.visibility,
      coverImageUrl: project.cover_image_url,
      goalType: project.goal_type,
      goalValue: Number(project.goal_value),
      currentValue: 0,
      displayAmount: project.display_amount,
      startAt: project.start_at ?? "",
      endAt: project.end_at ?? "",
      externalPaymentUrl: project.external_payment_url,
      externalApplicationUrl: project.external_application_url,
      whyNow: project.why_now,
      audience: project.audience,
      useOfSupport: project.use_of_support,
      schedule: project.schedule,
      riskNotes: project.risk_notes,
      cancellationPolicy: project.cancellation_policy,
      contactNote: project.contact_note,
      publishedAt: project.published_at,
      completedAt: project.completed_at,
      archivedAt: project.archived_at,
      createdAt: project.created_at,
      updatedAt: project.updated_at
    })),
    plans: planRows.flatMap<FundPlan>((plan) => {
      const sourceProjectId = sourceIdByDatabaseId.get(plan.project_id);
      if (!sourceProjectId) return [];
      return [{
        id: plan.source_local_id,
        projectId: sourceProjectId,
        title: plan.title,
        description: plan.description,
        imageUrl: plan.image_url,
        planType: plan.plan_type,
        price: plan.price === null ? null : Number(plan.price),
        quantityLimit: plan.quantity_limit,
        perPersonLimit: plan.per_person_limit,
        deliveryDate: plan.delivery_date ?? "",
        externalPaymentUrl: plan.external_payment_url,
        externalApplicationUrl: plan.external_application_url,
        requiredInformationNote: plan.required_information_note,
        requiresShipping: plan.requires_shipping,
        status: plan.status,
        sortOrder: plan.sort_order,
        createdAt: plan.created_at,
        updatedAt: plan.updated_at
      }];
    })
  };
}
