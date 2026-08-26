import { supabase } from "@/lib/supabase/client";

export type MarketScheduleSourcePreference = {
  id: string;
  source_service: string;
  source_calendar_key: string;
  source_label: string | null;
  is_visible: boolean;
  notifications_enabled: boolean;
  display_color: string;
};

export type MarketScheduleProjection = {
  id: string;
  source_service: string;
  source_calendar_key: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  starts_on: string | null;
  ends_on_exclusive: string | null;
  all_day: boolean;
  time_zone: string;
  location: string | null;
  status: "active" | "cancelled" | "withdrawn";
};

const preferenceColumns = "id,source_service,source_calendar_key,source_label,is_visible,notifications_enabled,display_color";
const projectionColumns = "id,source_service,source_calendar_key,title,starts_at,ends_at,starts_on,ends_on_exclusive,all_day,time_zone,location,status";

export async function listMarketScheduleSourcePreferences() {
  const { data, error } = await supabase
    .from("market_schedule_source_preferences")
    .select(preferenceColumns)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MarketScheduleSourcePreference[];
}

export async function listMarketScheduleProjections() {
  const { data, error } = await supabase
    .from("market_schedule_projections")
    .select(projectionColumns)
    .eq("status", "active")
    .order("starts_on", { ascending: true, nullsFirst: false })
    .order("starts_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as MarketScheduleProjection[];
}

export async function updateMarketScheduleSourcePreference(
  preferenceId: string,
  input: Pick<MarketScheduleSourcePreference, "is_visible" | "notifications_enabled" | "display_color">
) {
  const { data, error } = await supabase
    .from("market_schedule_source_preferences")
    .update(input)
    .eq("id", preferenceId)
    .select(preferenceColumns)
    .single();
  if (error) throw error;
  return data as MarketScheduleSourcePreference;
}

export function scheduleProjectionDateKey(item: MarketScheduleProjection) {
  if (item.all_day) return item.starts_on ?? "";
  if (!item.starts_at) return "";
  const date = new Date(item.starts_at);
  if (!Number.isFinite(date.getTime())) return "";
  if (item.time_zone === "UTC") return item.starts_at.slice(0, 10);
  const offset = item.time_zone.match(/^UTC([+-])(\d{2}):(\d{2})$/);
  if (offset) {
    const direction = offset[1] === "+" ? 1 : -1;
    const minutes = direction * (Number(offset[2]) * 60 + Number(offset[3]));
    return new Date(date.getTime() + minutes * 60_000).toISOString().slice(0, 10);
  }
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: item.time_zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  } catch {
    return item.starts_at.slice(0, 10);
  }
}

export function scheduleProjectionTimeLabel(item: MarketScheduleProjection) {
  if (item.all_day) return "終日";
  if (!item.starts_at) return "時間未設定";
  const date = new Date(item.starts_at);
  const offset = item.time_zone.match(/^UTC([+-])(\d{2}):(\d{2})$/);
  if (offset) {
    const direction = offset[1] === "+" ? 1 : -1;
    const minutes = direction * (Number(offset[2]) * 60 + Number(offset[3]));
    return new Date(date.getTime() + minutes * 60_000).toISOString().slice(11, 16);
  }
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: item.time_zone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  } catch {
    return item.starts_at.slice(11, 16);
  }
}
