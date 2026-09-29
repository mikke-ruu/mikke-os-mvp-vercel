import { supabase } from "@/lib/supabase/client";
import { getCourse, setCoursePublished } from "@/lib/academy/courses";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { getMyAcademyHeadquartersAccess } from "@/lib/academy/trial";
import { createFirstPublicationAccessRpc, createFirstPublicationCourseRpc, type FirstPublicationAccess } from "@/lib/academy/first-publication/access-client";
import { createFirstPublicationRpc, type FirstPublicationStatus } from "@/lib/academy/first-publication/rpc-client";
import type { Profile } from "@/types/database";

export type CoursePublicationAccess = { route: "legacy" | "subsequent" | "blocked"; message: string }
  | { route: "first"; message: string; access: FirstPublicationAccess; status: FirstPublicationStatus };

/** Read projection only. The existing database guards remain authoritative on every write. */
export async function getCoursePublicationAccess(profile: Profile, headquartersId: string): Promise<CoursePublicationAccess> {
  const hq = await getOwnedHeadquarters(profile.user_id, headquartersId);
  if (!hq || hq.id !== headquartersId || hq.owner_user_id !== profile.user_id) {
    return { route: "blocked", message: "講座の公開は本部の所有者が操作してください。" };
  }
  // Only a successful null selects legacy. Missing RPC / denied reads never fall back.
  const scheme = await createFirstPublicationAccessRpc(supabase)(headquartersId);
  if (scheme) {
    if (scheme.phase === "prepared" && !scheme.active && scheme.endsAt === null && scheme.cancellationAcceptedAt === null) {
      const status = await createFirstPublicationRpc(supabase)(headquartersId, { action: "status" });
      if (status && status.phase === "prepared" && status.firstPublishedAt === null && status.cancellationAcceptedAt === null &&
          status.policyVersion === scheme.policyVersion && status.policyVersion === "academy-first-publication-trial-2026-09-08-v1" &&
          status.termsRevision === "academy-first-publication-trial-terms-2026-09-08-v1") {
        return { route: "first", message: "初公開で無料期間が始まります。料金と契約への影響を確認してください。", access: scheme, status };
      }
    }
    if (scheme.active && ["trialing", "paid", "cancelled"].includes(scheme.phase) && scheme.endsAt && Date.parse(scheme.endsAt) > Date.now()) {
      return { route: "subsequent", message: "利用開始済みの制度で講座を公開します。" };
    }
    return { route: "blocked", message: "この利用状態ではここから公開できません。本部設定で利用状態と初回公開の手続きを確認してください。" };
  }
  const access = await getMyAcademyHeadquartersAccess(headquartersId);
  if (access?.headquarters_id === headquartersId && access.access_kind === "paid" &&
      ["active", "internal_grant"].includes(access.status) && access.can_use_live_features === true &&
      (access.ends_at === null || Date.parse(access.ends_at) > Date.now())) {
    return { route: "legacy", message: "現在の利用権で講座を公開します。" };
  }
  return { route: "blocked", message: "公開できる利用状態を確認できません。本部設定をご確認ください。" };
}

/** Publish saved course data only; never activate a trial, change consent, or grant learner access. */
export async function publishSavedCourse(profile: Profile, headquartersId: string, courseId: string, isCurrent: () => boolean = () => true) {
  const access = await getCoursePublicationAccess(profile, headquartersId);
  if (!isCurrent()) throw new Error("操作するアカウントが変わりました。状態を再確認してください。");
  if (access.route === "blocked" || access.route === "first") throw new Error(access.message);
  const before = await getCourse(headquartersId, courseId);
  if (!isCurrent()) throw new Error("操作するアカウントが変わりました。状態を再確認してください。");
  if (before.id !== courseId || before.headquarters_id !== headquartersId) throw new Error("講座の所属を確認できません。");
  if (before.is_published) return { course: before, warning: "" };
  try {
    if (access.route === "subsequent") {
      // This RPC owns the subsequent-publication transaction. Do not substitute a direct UPDATE.
      await createFirstPublicationCourseRpc(supabase)(headquartersId, courseId, true);
    } else {
      // Preserve legacy public activity-event semantics as well as its DB guards.
      await setCoursePublished(profile, headquartersId, before, true);
    }
  } catch {
    // A write may have committed before a response/activity-event error. Never blindly resend it.
    const observed = await getCourse(headquartersId, courseId).catch(() => null);
    if (observed?.id === courseId && observed.headquarters_id === headquartersId && observed.is_published) {
      return { course: observed, warning: "講座は公開済みです。公開処理の応答または実績記録を確認できませんでした。再公開せず、記録をご確認ください。" };
    }
    throw new Error("公開の完了を確認できませんでした。公開状態を確認してから、もう一度操作してください。");
  }
  const course = await getCourse(headquartersId, courseId);
  if (course.id !== courseId || course.headquarters_id !== headquartersId || !course.is_published) throw new Error("公開状態を確認できませんでした。状態を再確認してください。");
  return { course, warning: "" };
}

/** The reviewed quote is a comparison token, never a replacement for DB consent/expiry checks. */
export async function publishFirstSavedCourse(profile: Profile, headquartersId: string, courseId: string,
  reviewed: FirstPublicationStatus, isCurrent: () => boolean) {
  const access = await getCoursePublicationAccess(profile, headquartersId);
  if (!isCurrent()) throw new Error("操作するアカウントが変わりました。");
  if (access.route !== "first" || JSON.stringify(access.status) !== JSON.stringify(reviewed)) {
    throw new Error("契約の状態が変わりました。料金と契約への影響を確認し直してください。");
  }
  const before = await getCourse(headquartersId, courseId);
  if (!isCurrent() || before.id !== courseId || before.headquarters_id !== headquartersId || before.is_published) {
    throw new Error("保存済みの講座と公開状態を確認し直してください。");
  }
  // The existing atomic command validates owner, the prepared quote, expiry, price band and consent.
  // An uncertain response must be re-read by the user; never retry or fall back to a legacy UPDATE.
  const result = await createFirstPublicationRpc(supabase)(headquartersId,
    { action: "publish", courseId, quoteId: reviewed.quoteId, confirmed: true });
  if (!isCurrent()) throw new Error("操作するアカウントが変わりました。");
  if (!result || result.quoteId !== reviewed.quoteId || result.policyVersion !== reviewed.policyVersion ||
      result.amountYen !== reviewed.amountYen || result.firstPublishedAt === null) throw new Error("初公開の結果を確認できませんでした。");
  const course = await getCourse(headquartersId, courseId);
  if (!isCurrent() || course.id !== courseId || course.headquarters_id !== headquartersId || !course.is_published) {
    throw new Error("公開状態を確認できませんでした。");
  }
  return { course, warning: result.phase === "sync_pending" ? "講座は公開済みです。契約情報を確認中のため、再公開せず利用状態をご確認ください。" : "" };
}
