import { supabase } from "@/lib/supabase/client";
import type {
  FundAppLink,
  FundChallengeRecord,
  FundPlan,
  FundProject,
  FundSupport,
  FundTargetService,
  FundUpdate,
  FundUpdateInput
} from "./types";

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

type OwnerFundUpdateRow = {
  source_local_id: string;
  project_id: string;
  title: string;
  body: string;
  image_url: string;
  visibility: FundUpdate["visibility"];
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type OwnerFundSupportRow = {
  id: string;
  project_id: string;
  source_local_id: string;
  plan_source_id: string | null;
  supporter_name: string;
  supporter_email: string | null;
  public_name: string;
  is_anonymous: boolean;
  comment: string;
  support_type: FundSupport["supportType"];
  amount: number | null;
  quantity: number;
  payment_status: FundSupport["paymentStatus"];
  fulfillment_status: FundSupport["fulfillmentStatus"];
  record_status: FundSupport["recordStatus"];
  source: string;
  supported_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

type OwnerFundParticipationRow = {
  support_id: string;
  supporter_user_id: string;
};

type OwnerFundChallengeRecordRow = {
  source_local_id: string;
  project_id: string;
  title: string;
  summary: string;
  outcome: string;
  image_url: string;
  visibility: FundChallengeRecord["visibility"];
  story_enabled: boolean;
  completed_at: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type OwnerFundAppLinkRow = {
  id: string;
  project_id: string;
  target_service: FundTargetService;
  link_status: FundAppLink["linkStatus"];
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

const ownerUpdateColumns = `
  source_local_id, project_id, title, body, image_url, visibility,
  published_at, created_at, updated_at
`;

const ownerSupportColumns = `
  id, project_id, source_local_id, plan_source_id, supporter_name,
  supporter_email, public_name, is_anonymous, comment, support_type,
  amount, quantity, payment_status, fulfillment_status, record_status,
  source, supported_at, completed_at, cancelled_at, created_at, updated_at
`;

const ownerChallengeRecordColumns = `
  source_local_id, project_id, title, summary, outcome, image_url,
  visibility, story_enabled, completed_at, published_at, created_at, updated_at
`;

const ownerAppLinkColumns = `
  id, project_id, target_service, link_status, created_at, updated_at
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

export async function saveFundUpdate(input: {
  ownerProfileId: string;
  projectId: string;
  update: FundUpdateInput & { id: string };
}) {
  const { data, error } = await supabase.rpc("save_fund_update", {
    p_owner_profile_id: input.ownerProfileId,
    p_project_source_local_id: input.projectId,
    p_update: input.update
  });
  if (error) throw error;
  return data as string;
}

export async function saveFundSupport(input: {
  ownerProfileId: string;
  projectId: string;
  support: FundSupport;
}) {
  const { data, error } = await supabase.rpc("save_fund_support", {
    p_owner_profile_id: input.ownerProfileId,
    p_project_source_local_id: input.projectId,
    p_support: input.support
  });
  if (error) throw error;
  return data as string;
}

export async function saveFundCompletion(input: {
  ownerProfileId: string;
  projectId: string;
  record: FundChallengeRecord;
  targets: FundTargetService[];
}) {
  const { data, error } = await supabase.rpc("save_fund_completion", {
    p_owner_profile_id: input.ownerProfileId,
    p_project_source_local_id: input.projectId,
    p_record: input.record,
    p_targets: input.targets
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
  let updateRows: OwnerFundUpdateRow[] = [];
  let supportRows: OwnerFundSupportRow[] = [];
  let participationRows: OwnerFundParticipationRow[] = [];
  let challengeRecordRows: OwnerFundChallengeRecordRow[] = [];
  let appLinkRows: OwnerFundAppLinkRow[] = [];

  if (databaseProjectIds.length > 0) {
    const [planResult, updateResult, supportResult, challengeRecordResult, appLinkResult] = await Promise.all([
      supabase
        .from("fund_plans")
        .select(ownerPlanColumns)
        .in("project_id", databaseProjectIds)
        .order("sort_order", { ascending: true }),
      supabase
        .from("fund_updates")
        .select(ownerUpdateColumns)
        .in("project_id", databaseProjectIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("fund_supports")
        .select(ownerSupportColumns)
        .in("project_id", databaseProjectIds)
        .order("supported_at", { ascending: false }),
      supabase
        .from("fund_challenge_records")
        .select(ownerChallengeRecordColumns)
        .in("project_id", databaseProjectIds)
        .order("updated_at", { ascending: false }),
      supabase
        .from("fund_app_links")
        .select(ownerAppLinkColumns)
        .in("project_id", databaseProjectIds)
        .order("created_at", { ascending: true })
    ]);

    if (planResult.error) throw planResult.error;
    if (updateResult.error) throw updateResult.error;
    if (supportResult.error) throw supportResult.error;
    if (challengeRecordResult.error) throw challengeRecordResult.error;
    if (appLinkResult.error) throw appLinkResult.error;
    planRows = (planResult.data ?? []) as unknown as OwnerFundPlanRow[];
    updateRows = (updateResult.data ?? []) as unknown as OwnerFundUpdateRow[];
    supportRows = (supportResult.data ?? []) as unknown as OwnerFundSupportRow[];
    challengeRecordRows = (challengeRecordResult.data ?? []) as unknown as OwnerFundChallengeRecordRow[];
    appLinkRows = (appLinkResult.data ?? []) as unknown as OwnerFundAppLinkRow[];

    if (supportRows.length > 0) {
      const { data: participationData, error: participationError } = await supabase
        .from("fund_participations")
        .select("support_id, supporter_user_id")
        .in("support_id", supportRows.map((support) => support.id));
      if (participationError) throw participationError;
      participationRows = (participationData ?? []) as unknown as OwnerFundParticipationRow[];
    }
  }

  const sourceIdByDatabaseId = new Map(projectRows.map((project) => [project.id, project.source_local_id]));
  const supporterUserIdBySupportId = new Map(
    participationRows.map((participation) => [participation.support_id, participation.supporter_user_id])
  );

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
    }),
    supports: supportRows.flatMap<FundSupport>((support) => {
      const sourceProjectId = sourceIdByDatabaseId.get(support.project_id);
      if (!sourceProjectId) return [];
      return [{
        id: support.source_local_id,
        projectId: sourceProjectId,
        planId: support.plan_source_id ?? "",
        supporterUserId: supporterUserIdBySupportId.get(support.id) ?? "",
        supporterName: support.supporter_name,
        supporterEmail: support.supporter_email ?? "",
        publicName: support.public_name,
        isAnonymous: support.is_anonymous,
        supportType: support.support_type,
        amount: support.amount === null ? null : Number(support.amount),
        quantity: support.quantity,
        paymentStatus: support.payment_status,
        fulfillmentStatus: support.fulfillment_status,
        recordStatus: support.record_status,
        comment: support.comment,
        source: support.source,
        supportedAt: support.supported_at.slice(0, 10),
        completedAt: support.completed_at,
        cancelledAt: support.cancelled_at,
        createdAt: support.created_at,
        updatedAt: support.updated_at
      }];
    }),
    updates: updateRows.flatMap<FundUpdate>((update) => {
      const sourceProjectId = sourceIdByDatabaseId.get(update.project_id);
      if (!sourceProjectId) return [];
      return [{
        id: update.source_local_id,
        projectId: sourceProjectId,
        title: update.title,
        body: update.body,
        imageUrl: update.image_url,
        visibility: update.visibility,
        publishedAt: update.published_at,
        createdAt: update.created_at,
        updatedAt: update.updated_at
      }];
    }),
    challengeRecords: challengeRecordRows.flatMap<FundChallengeRecord>((record) => {
      const sourceProjectId = sourceIdByDatabaseId.get(record.project_id);
      if (!sourceProjectId) return [];
      return [{
        id: record.source_local_id,
        projectId: sourceProjectId,
        title: record.title,
        summary: record.summary,
        outcome: record.outcome,
        imageUrl: record.image_url,
        visibility: record.visibility,
        storyEnabled: record.story_enabled,
        completedAt: record.completed_at,
        publishedAt: record.published_at,
        createdAt: record.created_at,
        updatedAt: record.updated_at
      }];
    }),
    appLinks: appLinkRows.flatMap<FundAppLink>((link) => {
      const sourceProjectId = sourceIdByDatabaseId.get(link.project_id);
      if (!sourceProjectId) return [];
      return [{
        id: link.id,
        projectId: sourceProjectId,
        targetService: link.target_service,
        linkStatus: link.link_status,
        createdAt: link.created_at,
        updatedAt: link.updated_at
      }];
    })
  };
}
