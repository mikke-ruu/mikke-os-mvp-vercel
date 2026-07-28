import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveStaffOrganizationIds } from "@/lib/team-works-operations";

export type PartnerShiftStatus = "draft" | "submitted" | "confirmed" | "returned";

export type PartnerShiftSubmission = {
  id: string;
  organizationId: string;
  partnerMemberId: string;
  partnerName: string;
  targetMonth: string;
  desiredDays: number;
  availableDates: string[];
  note: string;
  status: PartnerShiftStatus;
  submittedAt: string | null;
  confirmedAt: string | null;
};

export type PartnerShiftMembership = {
  organizationId: string;
  partnerMemberId: string;
  partnerName: string;
};

type ShiftRow = {
  id: string;
  organization_id: string;
  partner_member_id: string;
  target_month: string;
  desired_days: number;
  available_dates: string[];
  note: string | null;
  status: PartnerShiftStatus;
  submitted_at: string | null;
  confirmed_at: string | null;
};

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function normalizeAvailableDates(values: string[], targetMonth: Date): string[] {
  const prefix = monthKey(targetMonth).slice(0, 7);
  return [...new Set(values.filter((value) => value.startsWith(`${prefix}-`)))].sort();
}

function toSubmission(row: ShiftRow, partnerName: string): PartnerShiftSubmission {
  return {
    id: row.id,
    organizationId: row.organization_id,
    partnerMemberId: row.partner_member_id,
    partnerName,
    targetMonth: row.target_month,
    desiredDays: row.desired_days,
    availableDates: row.available_dates ?? [],
    note: row.note ?? "",
    status: row.status,
    submittedAt: row.submitted_at,
    confirmedAt: row.confirmed_at
  };
}

export async function resolveMyPartnerShiftMembership(client: SupabaseClient): Promise<PartnerShiftMembership | null> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return null;

  const { data, error } = await client
    .from("team_works_organization_members")
    .select("id,organization_id,display_name")
    .eq("user_id", userData.user.id)
    .eq("role", "worker")
    .eq("status", "active")
    .limit(1);
  if (error) throw error;
  const row = data?.[0] as { id: string; organization_id: string; display_name: string } | undefined;
  return row
    ? { organizationId: row.organization_id, partnerMemberId: row.id, partnerName: row.display_name }
    : null;
}

export async function loadMyPartnerShift(
  client: SupabaseClient,
  targetMonth: Date
): Promise<{ membership: PartnerShiftMembership | null; submission: PartnerShiftSubmission | null }> {
  const membership = await resolveMyPartnerShiftMembership(client);
  if (!membership) return { membership: null, submission: null };
  const { data, error } = await client
    .from("team_works_partner_shift_submissions")
    .select("id,organization_id,partner_member_id,target_month,desired_days,available_dates,note,status,submitted_at,confirmed_at")
    .eq("partner_member_id", membership.partnerMemberId)
    .eq("target_month", monthKey(targetMonth))
    .maybeSingle();
  if (error) throw error;
  return {
    membership,
    submission: data ? toSubmission(data as ShiftRow, membership.partnerName) : null
  };
}

export async function submitMyPartnerShift(
  client: SupabaseClient,
  input: { targetMonth: Date; desiredDays: number; availableDates: string[]; note: string }
): Promise<PartnerShiftSubmission> {
  const membership = await resolveMyPartnerShiftMembership(client);
  if (!membership) throw new Error("パートナー登録を確認できません。");
  const availableDates = normalizeAvailableDates(input.availableDates, input.targetMonth);
  if (availableDates.length === 0) throw new Error("稼働できる日を1日以上選んでください。");
  const desiredDays = Math.max(1, Math.min(31, Math.trunc(input.desiredDays)));
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("team_works_partner_shift_submissions")
    .upsert({
      organization_id: membership.organizationId,
      partner_member_id: membership.partnerMemberId,
      target_month: monthKey(input.targetMonth),
      desired_days: desiredDays,
      available_dates: availableDates,
      note: input.note.trim() || null,
      status: "submitted",
      submitted_at: now,
      updated_at: now
    }, { onConflict: "partner_member_id,target_month" })
    .select("id,organization_id,partner_member_id,target_month,desired_days,available_dates,note,status,submitted_at,confirmed_at")
    .single();
  if (error) throw error;
  return toSubmission(data as ShiftRow, membership.partnerName);
}

export async function loadStaffPartnerShifts(
  client: SupabaseClient,
  targetMonth: Date
): Promise<PartnerShiftSubmission[]> {
  const organizationIds = await resolveStaffOrganizationIds(client);
  if (organizationIds.length === 0) return [];
  const { data, error } = await client
    .from("team_works_partner_shift_submissions")
    .select("id,organization_id,partner_member_id,target_month,desired_days,available_dates,note,status,submitted_at,confirmed_at")
    .in("organization_id", organizationIds)
    .eq("target_month", monthKey(targetMonth))
    .order("submitted_at", { ascending: false });
  if (error?.code === "42P01" || error?.code === "PGRST205") return [];
  if (error) throw error;
  const rows = (data ?? []) as ShiftRow[];
  if (rows.length === 0) return [];

  const memberIds = [...new Set(rows.map((row) => row.partner_member_id))];
  const memberResult = await client
    .from("team_works_organization_members")
    .select("id,display_name")
    .in("id", memberIds);
  if (memberResult.error) throw memberResult.error;
  const memberNames = new Map(
    ((memberResult.data ?? []) as { id: string; display_name: string }[]).map((row) => [row.id, row.display_name])
  );
  return rows.map((row) => toSubmission(row, memberNames.get(row.partner_member_id) ?? "パートナー"));
}

export async function confirmStaffPartnerShift(
  client: SupabaseClient,
  submissionId: string
): Promise<void> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("本部アカウントでログインしてください。");
  const now = new Date().toISOString();
  const { error } = await client
    .from("team_works_partner_shift_submissions")
    .update({
      status: "confirmed",
      confirmed_at: now,
      confirmed_by_user_id: userData.user.id,
      updated_at: now
    })
    .eq("id", submissionId);
  if (error) throw error;
}
