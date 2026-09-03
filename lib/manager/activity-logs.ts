import { supabase } from "@/lib/supabase/client";

export type ManagerActivityLog = {
  sourceService: string;
  occurredAt: string;
  endedAt: string | null;
  title: string;
  description: string | null;
  status: string | null;
};

type ManagerActivityLogRow = {
  source_service: string;
  occurred_at: string;
  ended_at: string | null;
  title: string;
  description: string | null;
  status: string | null;
};

const managerActivityLogColumns = "source_service, occurred_at, ended_at, title, description, status";
const marketNoteSourceServices = new Set(["marketnote", "market_note"]);

export function isManagerAchievement(log: ManagerActivityLog, now = new Date()) {
  if (!marketNoteSourceServices.has(log.sourceService) || log.status !== "confirmed") return false;
  const endedOn = log.endedAt ? /^\d{4}-\d{2}-\d{2}/.exec(log.endedAt)?.[0] : null;
  return Boolean(endedOn && endedOn < getJapanDateKey(now));
}

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
    endedAt: row.ended_at,
    title: row.title,
    description: row.description,
    status: row.status
  }));
}

function getJapanDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
