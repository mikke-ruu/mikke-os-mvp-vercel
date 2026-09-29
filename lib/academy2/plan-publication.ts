import {monthlyPolicyReasonLabels} from './monthly-policy-display.mjs';
import { supabase } from "@/lib/supabase/client";
import { assertAcademyWritable } from "@/lib/academy/preview";

export type PublicationInput = { headquartersId: string; planId: string; planRevision: number; pageRevision: number; eventId: string | null; eventRevision: number | null };
export type PublicationReadiness = { ready: boolean; reasons: string[]; plan_revision: number; page_revision: number; offering_id: string | null; starts_new_trial: boolean };
export type PlanPublication = { plan_id: string; plan_revision: number; page_revision: number; offering_id: string; public_path: string; event: { id: string; revision: number } | null; starts_new_trial: boolean };
export type FirstPublicationState = {phase:string; can_consent:boolean; consented:boolean;first_published_at:string|null;trial_ends_at:string|null;policy_version:string|null;terms_revision:string|null;enrollment:unknown;quote:{id:string;amount_yen:number;terms_revision:string;payment_verified:boolean;expires_at:string}|null};
export async function getFirstPublicationState(headquartersId:string):Promise<FirstPublicationState>{
  const {data,error}=await supabase.rpc('academy2_first_publication_status',{p_headquarters_id:headquartersId});
  if(error)throw new Error('初公開の契約状態を確認できませんでした。');
  return data as FirstPublicationState;
}
const reasons: Record<string, string> = {
  ...monthlyPolicyReasonLabels,
  revision_changed: "販売プランまたはページが更新されています。最新の保存内容を確認してください。",
  page_needs_rebase: "更新した販売プランの内容で販売ページを確認し、保存してください。",
  empty_page_renderer_pending: "内容が空の販売ページは、まだ募集公開に対応していません。",
  existing_public_contract_required: "本部責任者による利用規約・料金・支払方法の確認が必要です。",
  single_course_bridge_only: "複数講座を含む販売プランの申込受付はまだ接続されていません。",
  course_public_projection_pending: "この講座の公開情報を安全に表示する処理はまだ接続されていません。",
  title_or_price_required: "販売プラン名と販売価格を確認してください。",
  sales_type_or_staged_purchase_pending: "この販売タイプまたは講座ごとの購入には、まだ申込受付が接続されていません。",
  bank_only_bridge: "現在接続済みの申込受付は銀行振込のみです。",
  learner_material_release_pending: "レッスン教材を提供する販売プランの公開は、教材の開放処理を接続するまで保留です。",
  teaching_method_required: "対面またはオンラインの受講方法を確認してください。",
  rights_or_dues_flow_pending: "ライセンス・会費を含む販売プランの申込受付はまだ接続されていません。",
  kit_public_application_pending: "キットを含む販売プランの申込受付はまだ接続されていません。",
  after_course_flow_pending: "設定した受講後の処理がまだ申込受付に接続されていません。",
  six_step_review_settings_pending: "講座の発送物・決済契約・受講後の設定を確認してください。未接続の業務を含む設定はまだ公開できません。",
  application_terms_required: "申込規約の本文とバージョンを設定してください。",
  application_form_answers_pending: "追加した申込項目の回答保存はまだ接続されていません。",
  event_required: "この販売プランに対応する開催を保存してください。",
  event_revision_changed: "開催または販売プランが更新されています。最新の内容を確認してください。",
  event_not_ready: "開催の状態・受講方法・日程を確認してください。",
  published_conditions_change_pending: "公開後の販売条件や開催の変更は、既存の申込を保全する処理を接続するまで保留です。",
};
export function publicationReason(reason: string): string { return reasons[reason] ?? "募集公開に必要な処理を確認しています。保存済みの内容は維持されています。"; }
function params(input: PublicationInput) {
  return { p_headquarters_id: input.headquartersId, p_plan_id: input.planId, p_plan_revision: input.planRevision, p_page_revision: input.pageRevision, p_event_id: input.eventId, p_event_revision: input.eventRevision };
}
function failure(error: { code?: string; details?: string | null }): Error {
  if (error.code === "42501") return new Error("この販売プランを募集公開する権限がありません。");
  if (error.code === "PT409") return new Error("保存内容が更新されています。最新の販売プラン・ページ・開催を確認してください。");
  if (error.code === "22023" && error.details) {
    try { const codes: unknown = JSON.parse(error.details); if (Array.isArray(codes) && codes.every(code => typeof code === "string")) return new Error(codes.map(publicationReason).join("\n")); } catch { /* Not a structured readiness response. */ }
  }
  return new Error("募集公開の結果を確認できませんでした。内容を変更せず、同じ操作でもう一度確認してください。");
}
export async function getPlanPublicationReadiness(input: PublicationInput): Promise<PublicationReadiness> {
  const { data, error } = await supabase.rpc("academy2_plan_publication_readiness", params(input));
  if (error) throw failure(error);
  return data as PublicationReadiness;
}
/** Keep requestId unchanged when retrying an uncertain response. */
export async function publishExistingHeadquartersPlan(input: PublicationInput, requestId: string): Promise<PlanPublication> {
  assertAcademyWritable();
  const { data, error } = await supabase.rpc("academy2_publish_plan", { ...params(input), p_request_id: requestId });
  if (error) throw failure(error);
  return data as PlanPublication;
}
