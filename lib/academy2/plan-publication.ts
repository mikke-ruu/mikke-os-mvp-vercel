import {academyPublicClient} from '@/lib/academy/public-client';
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
  bank_transfer_instructions_required: '設定の「お支払い」で、振込先とお客様への支払い案内を登録してください。',
  seller_disclosure_required: '設定の「規約・契約」で、販売者情報とキャンセル・返金ポリシー、プライバシーポリシーを確認してください。',
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
  page_save_required: "販売ページを確認して保存してください。",
  page_content_required: "販売ページの内容を入れてください。",
  existing_accepting_publication_unchanged: "受付中の販売ページです。現在の公開内容を保持したまま、既存の更新手順を確認してください。",
  plan_archived: "アーカイブから販売プランを戻してください。",
  management_status_unavailable: "販売プランの保存状態を確認できませんでした。状態を再取得してください。",
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

/** Information-page commands never start intake, a trial, or a billing contract.
 * These RPCs require the separately reviewed local SQL candidate. Missing RPCs
 * fail closed; never fall back to academy2_publish_plan (which opens intake).
 */
export type SalesPagePublicationInput = Pick<PublicationInput, 'headquartersId' | 'planId' | 'planRevision' | 'pageRevision'>;
export type SalesPagePublicationReadiness = {
  ready: boolean; reasons: string[]; plan_revision: number; page_revision: number;
  event_required: false; starts_new_trial: false;
};
export type SalesPagePublicationResult = {
  plan_id: string; headquarters_id: string; plan_revision: number; page_revision: number;
  public_path: string; published_at: string; visible: boolean; accepting: false; starts_new_trial: false;
};
export type PublishedSalesPage = {
  cover_image?:import('./plan-cover-image').PlanCoverImage|null;
  plan_id: string; headquarters_id: string; title: string; price: number;
  currency: 'JPY'; blocks: import('@/components/mikkeos/page-builder/lp-design').LpBlock[];
  courses: {id: string; name: string; subtitle: string | null; main_image_url: string | null;
    description: string | null; can_do_after: string | null; duration_text: string | null; marketing?:{images:string[]}}[];
  plan_revision: number; page_revision: number; published_at: string; visible: true;
  accepting: boolean; application_path: string | null;
};
export type SalesPagePublicationStatus={state:'not_published'|'published'|'unpublished';plan_id:string;headquarters_id:string;plan_revision:number|null;page_revision:number|null;published_at:string|null;public_path:string|null;has_unpublished_changes:boolean};
export type PublishedSalesPageSummary={plan_id:string;headquarters_id:string;title:string;price:number;currency:'JPY';public_path:string;main_image_url:string|null};
export async function listPublishedSalesPages(headquartersId:string):Promise<PublishedSalesPageSummary[]>{
  const {data,error}=await academyPublicClient.rpc('academy2_public_information_pages',{p_headquarters_id:headquartersId}).abortSignal(AbortSignal.timeout(30_000));
  if(error)throw informationPageFailure(error);
  if(!Array.isArray(data)||!data.every(item=>item?.headquarters_id===headquartersId&&typeof item.plan_id==='string'&&item.public_path===`/academy/page/${item.plan_id}`&&typeof item.title==='string'&&typeof item.price==='number'&&item.currency==='JPY'))throw new Error('販売ページの一覧を確認できませんでした。');
  return data as PublishedSalesPageSummary[];
}
export async function getEventPreparationReadiness(headquartersId:string,planId:string,planRevision:number):Promise<SalesPagePublicationReadiness>{
  const {data,error}=await supabase.rpc('academy2_event_preparation_readiness',{p_headquarters_id:headquartersId,p_plan_id:planId,p_plan_revision:planRevision}).abortSignal(AbortSignal.timeout(30_000));
  if(error)throw informationPageFailure(error);
  if(!data||data.plan_revision!==planRevision||typeof data.ready!=='boolean'||!Array.isArray(data.reasons)||!data.reasons.every((reason:unknown)=>typeof reason==='string')||data.event_required!==false||data.starts_new_trial!==false)throw new Error('開催を追加するための設定を確認できませんでした。');
  return data as SalesPagePublicationReadiness;
}
export async function getSalesPagePublicationStatus(headquartersId:string,planId:string):Promise<SalesPagePublicationStatus>{
  const {data,error}=await supabase.rpc('academy2_information_page_status',{p_headquarters_id:headquartersId,p_plan_id:planId}).abortSignal(AbortSignal.timeout(30_000));
  if(error)throw informationPageFailure(error);
  if(!data||data.plan_id!==planId||data.headquarters_id!==headquartersId||!['not_published','published','unpublished'].includes(data.state)||typeof data.has_unpublished_changes!=='boolean')throw new Error('ページの公開状態を確認できませんでした。');
  return data as SalesPagePublicationStatus;
}
function informationPageParams(input: SalesPagePublicationInput) {
  return {p_headquarters_id:input.headquartersId,p_plan_id:input.planId,p_plan_revision:input.planRevision,p_page_revision:input.pageRevision};
}
function informationPageFailure(error:{code?:string;details?:string|null}):Error {
  if(error.code==='PGRST202'||error.code==='42883')return new Error('日程と分けてページを公開する機能は、この環境ではまだ準備中です。公開内容は変更していません。');
  if(error.code==='42501'||error.code==='PT409'||(error.code==='22023'&&error.details))return failure(error);
  return new Error('操作の結果を確認できませんでした。再送せず、保存状態と公開状態を確認してください。');
}
export async function getSalesPagePublicationReadiness(input:SalesPagePublicationInput):Promise<SalesPagePublicationReadiness> {
  const {data,error}=await supabase.rpc('academy2_sales_page_publication_readiness',informationPageParams(input)).abortSignal(AbortSignal.timeout(30_000));
  if(error)throw informationPageFailure(error);
  if(!data||data.event_required!==false||data.starts_new_trial!==false||typeof data.ready!=='boolean'||!Array.isArray(data.reasons)||!data.reasons.every((reason:unknown)=>typeof reason==='string')
    || data.plan_revision!==input.planRevision||data.page_revision!==input.pageRevision)throw new Error('ページの公開条件を確認できませんでした。');
  return data as SalesPagePublicationReadiness;
}
async function informationPageCommand(input:SalesPagePublicationInput,requestId:string,visible:boolean):Promise<SalesPagePublicationResult> {
  assertAcademyWritable();
  const {data,error}=await supabase.rpc('academy2_publish_information_page',{...informationPageParams(input),p_request_id:requestId,p_visible:visible}).abortSignal(AbortSignal.timeout(30_000));
  if(error)throw informationPageFailure(error);
  if(!data||data.plan_id!==input.planId||data.headquarters_id!==input.headquartersId||data.visible!==visible||data.accepting!==false||data.starts_new_trial!==false
    ||data.public_path!==`/academy/page/${input.planId}`||(visible&&(data.plan_revision!==input.planRevision||data.page_revision!==input.pageRevision)))throw new Error('公開操作の結果を確認できませんでした。再送せず保存状態を確認してください。');
  return data as SalesPagePublicationResult;
}
/** One call only. On an uncertain response, read state; never automatically resend. */
export function publishSalesPage(input:SalesPagePublicationInput,requestId:string){return informationPageCommand(input,requestId,true);}
export function unpublishSalesPage(input:SalesPagePublicationInput,requestId:string){return informationPageCommand(input,requestId,false);}
export async function getPublishedSalesPage(planId:string):Promise<PublishedSalesPage|null> {
  const {data,error}=await academyPublicClient.rpc('academy2_public_information_page',{p_plan_id:planId}).abortSignal(AbortSignal.timeout(30_000));
  if(error)throw informationPageFailure(error);
  if(data===null)return null;
  if(!data||data.plan_id!==planId||data.visible!==true||typeof data.accepting!=='boolean'||!Array.isArray(data.blocks)||!Array.isArray(data.courses)
    || (data.accepting ? typeof data.application_path!=='string'||!/^\/academy\/o\/[0-9a-f-]{36}$/i.test(data.application_path) : data.application_path!==null))throw new Error('公開ページの内容を確認できませんでした。');
  return data as PublishedSalesPage;
}
