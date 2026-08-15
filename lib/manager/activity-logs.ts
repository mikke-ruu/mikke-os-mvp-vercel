import { supabase } from "@/lib/supabase/client";

export type ManagerActivityLog = {
  sourceService: string;
  occurredAt: string;
  title: string;
  description: string | null;
};

type ManagerActivityLogRow = {
  source_service: string;
  occurred_at: string;
  title: string;
  description: string | null;
};

const managerActivityLogColumns = "source_service, occurred_at, title, description";

export async function listMyManagerActivityLogs(userId: string): Promise<ManagerActivityLog[]> {
  const { data, error } = await supabase
    .from("activity_logs")
    .select(managerActivityLogColumns)
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  return ((data ?? []) as ManagerActivityLogRow[]).map((row) => ({
    sourceService: row.source_service,
    occurredAt: row.occurred_at,
    title: row.title,
    description: row.description
  }));
}
