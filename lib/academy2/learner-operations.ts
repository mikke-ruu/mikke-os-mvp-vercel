import { supabase } from "@/lib/supabase/client";

/** Read-only, server-scoped to the signed-in learner. No caller-supplied user ID.
 * This does not grant materials, issue certificates or expose teacher invoices. */
export type Academy2LearnerApplication = {
  id: string;
  headquarters_id: string;
  headquarters_name: string;
  sales_plan_id: string;
  sales_plan_name: string;
  application_status: string;
  materials_available?: boolean;
  applied_at: string;
  tuition: { amount: number; payment_method: string; paid_at: string | null };
  schedule: {
    id: string;
    title: string;
    schedule_mode: "fixed" | "arranged_after_application";
    starts_at: string | null;
    ends_at: string | null;
    format: "in_person" | "online";
    venue_name: string | null;
    meeting_url: string | null;
    status: string;
  } | null;
  completed_at: string | null;
  certification: { certified_at: string } | null;
};

async function read<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    throw Object.assign(new Error(error.code === "42501"
      ? "この申込は確認できません。申込時のアカウントでログインしてください。"
      : "申込情報を読み込めませんでした。もう一度お試しください。"), { code: error.code });
  }
  return data as T;
}

export function listMyAcademy2Applications(options: { headquartersId?: string; limit?: number; offset?: number } = {}) {
  return read<Academy2LearnerApplication[]>("academy2_my_applications", {
    p_headquarters_id: options.headquartersId ?? null,
    p_limit: options.limit ?? 50,
    p_offset: options.offset ?? 0,
  });
}

export function getMyAcademy2Application(applicationId: string) {
  return read<Academy2LearnerApplication>("academy2_my_application", { p_application_id: applicationId });
}
