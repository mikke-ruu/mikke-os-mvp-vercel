import { supabase } from "@/lib/supabase/client";

export type AiTechNewsCategory =
  | "ai_general"
  | "openai_codex"
  | "claude"
  | "google"
  | "image"
  | "web_ui"
  | "video"
  | "automation"
  | "new_tools";

export type AiTechSource = {
  id: string;
  source_key: string;
  name: string;
  publisher: string;
  official_url: string;
  feed_url: string | null;
  source_kind: "official" | "trusted_media";
  priority: number;
  last_fetched_at: string | null;
};

export type AiTechNews = {
  id: string;
  source_id: string;
  title: string;
  summary: string;
  why_it_matters: string;
  source_url: string;
  category: AiTechNewsCategory;
  importance_score: number;
  published_at: string | null;
  fetched_at: string;
};

export type AiTechCandidate = {
  id: string;
  news_id: string;
  category: "image" | "web_ui" | "video" | "development" | "automation" | "content" | "new_feature";
  use_places: string[];
  possible_use: string;
  expected_benefit: string;
  impact_score: number;
  confidence_score: number;
  effort: "small" | "medium" | "large";
  risk: "low" | "medium" | "high";
  test_idea: string;
  status: "candidate" | "approved_for_lab" | "held" | "dismissed";
  evaluated_at: string;
};

export type AiTechExperiment = {
  id: string;
  experiment_number: number;
  candidate_id: string;
  title: string;
  objective: string;
  test_plan: string;
  safety_scope: string;
  status: "approved" | "running" | "result_ready" | "adopted" | "held" | "rejected";
  result_summary: string;
  quality_result: string;
  mobile_result: string;
  speed_result: string;
  cost_result: string;
  environment_risk: string;
  recommendation: string;
  implementation_item_id: string | null;
  approved_at: string;
  decided_at: string | null;
  decision_note: string;
  updated_at: string;
};

export type AiTechAdoption = {
  id: string;
  experiment_id: string;
  title: string;
  area: "web" | "image" | "video" | "development" | "automation" | "content" | "product";
  summary: string;
  method_markdown: string;
  codex_target_kind: "pending" | "skill" | "agents" | "template" | "prompt" | "rule";
  codex_target_path: string | null;
  integration_status: "pending" | "documented" | "integrated" | "retired";
  adopted_at: string;
  reviewed_at: string | null;
};

export type AiTechWeeklyReport = {
  id: string;
  week_start: string;
  title: string;
  summary: string;
  status: "draft" | "published";
  published_at: string | null;
};

export type AiTechLabData = {
  sources: AiTechSource[];
  news: AiTechNews[];
  candidates: AiTechCandidate[];
  experiments: AiTechExperiment[];
  adoptions: AiTechAdoption[];
  reports: AiTechWeeklyReport[];
};

function rows<T>(data: unknown[] | null, error: { message: string } | null): T[] {
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export async function loadAiTechLab(): Promise<AiTechLabData> {
  const [sources, news, candidates, experiments, adoptions, reports] = await Promise.all([
    supabase
      .from("mikkeos_ai_tech_sources")
      .select("id,source_key,name,publisher,official_url,feed_url,source_kind,priority,last_fetched_at")
      .eq("is_active", true)
      .order("priority", { ascending: false }),
    supabase
      .from("mikkeos_ai_tech_news")
      .select("id,source_id,title,summary,why_it_matters,source_url,category,importance_score,published_at,fetched_at")
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(80),
    supabase
      .from("mikkeos_ai_tech_candidates")
      .select("id,news_id,category,use_places,possible_use,expected_benefit,impact_score,confidence_score,effort,risk,test_idea,status,evaluated_at")
      .order("impact_score", { ascending: false })
      .order("evaluated_at", { ascending: false }),
    supabase
      .from("mikkeos_ai_tech_experiments")
      .select("id,experiment_number,candidate_id,title,objective,test_plan,safety_scope,status,result_summary,quality_result,mobile_result,speed_result,cost_result,environment_risk,recommendation,implementation_item_id,approved_at,decided_at,decision_note,updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("mikkeos_ai_tech_adoptions")
      .select("id,experiment_id,title,area,summary,method_markdown,codex_target_kind,codex_target_path,integration_status,adopted_at,reviewed_at")
      .order("adopted_at", { ascending: false }),
    supabase
      .from("mikkeos_ai_tech_weekly_reports")
      .select("id,week_start,title,summary,status,published_at")
      .eq("status", "published")
      .order("week_start", { ascending: false })
      .limit(8)
  ]);

  return {
    sources: rows<AiTechSource>(sources.data, sources.error),
    news: rows<AiTechNews>(news.data, news.error),
    candidates: rows<AiTechCandidate>(candidates.data, candidates.error),
    experiments: rows<AiTechExperiment>(experiments.data, experiments.error),
    adoptions: rows<AiTechAdoption>(adoptions.data, adoptions.error),
    reports: rows<AiTechWeeklyReport>(reports.data, reports.error)
  };
}

export async function approveAiTechCandidate(candidateId: string): Promise<string> {
  const { data, error } = await supabase.rpc("mikkeos_ai_tech_approve_for_lab", {
    p_candidate_id: candidateId
  });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function decideAiTechExperiment(
  experimentId: string,
  decision: "adopt" | "hold" | "reject",
  note = ""
): Promise<void> {
  const { error } = await supabase.rpc("mikkeos_ai_tech_decide_experiment", {
    p_experiment_id: experimentId,
    p_decision: decision,
    p_note: note
  });
  if (error) throw new Error(error.message);
}
