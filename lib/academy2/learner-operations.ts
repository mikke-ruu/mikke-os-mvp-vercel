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
    individual_consultation?:boolean;individual_state?:'consulting'|'confirmed'|'changed';
    id: string;
    title: string;
    schedule_mode: "fixed" | "arranged_after_application";
    starts_at: string | null;
    ends_at: string | null;
    format: "in_person" | "online";
    venue_name: string | null;
    location?:{address:string|null;area:string;participant_note:string|null}|null;
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

/** Snapshot and fulfillment status, scoped by the RPC to auth.uid(). No addresses. */
export type Academy2LearnerMaterials={enabled:boolean;items:{course_id:string;name:string;contents:string}[];method:'none'|'venue_handover'|'learner_shipping'|'designated_shipping';status:'not_required'|'preparing'|'shipped';shipped_at:string|null;tracking_number:string|null};
export async function getMyAcademy2Materials(applicationId:string):Promise<Academy2LearnerMaterials|null>{
 const value=await read<Academy2LearnerMaterials|null>('academy2_my_physical_items',{p_application:applicationId});
 if(value===null)return null;
 if(!value||typeof value.enabled!=='boolean'||!Array.isArray(value.items)||value.items.some(item=>!item||typeof item.course_id!=='string'||typeof item.name!=='string'||typeof item.contents!=='string')||!['none','venue_handover','learner_shipping','designated_shipping'].includes(value.method)||!['not_required','preparing','shipped'].includes(value.status)||value.shipped_at!==null&&typeof value.shipped_at!=='string'||value.tracking_number!==null&&typeof value.tracking_number!=='string')throw new Error('物品・発送情報を確認できませんでした。もう一度お試しください。');
 return value;
}
