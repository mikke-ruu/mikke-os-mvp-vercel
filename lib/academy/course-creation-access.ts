import { listMyAcademyContexts } from "@/lib/academy/access-context";
import { isAcademyLocalReview } from "@/lib/academy/preview";
import { getMyAcademyHeadquartersAccess } from "@/lib/academy/trial";

export type AcademyCourseCreationAccess =
  | { allowed: true; reason: null }
  | { allowed: false; reason: string };

export async function getMyAcademyCourseCreationAccess(
  headquartersId: string
): Promise<AcademyCourseCreationAccess> {
  if (isAcademyLocalReview()) return { allowed: true, reason: null };

  try {
    const [contexts, access] = await Promise.all([
      listMyAcademyContexts(),
      getMyAcademyHeadquartersAccess(headquartersId)
    ]);
    const context = contexts.find((candidate) => candidate.academy_id === headquartersId);
    if (!context?.capabilities.includes("academy:courses:manage")) {
      return {
        allowed: false,
        reason: "この本部では講座を作成できません。本部設定で役割を確認してください。"
      };
    }
    if (!access?.can_manage_drafts) {
      return {
        allowed: false,
        reason: "現在は閲覧専用です。Academyの利用状態を確認してください。"
      };
    }
    return { allowed: true, reason: null };
  } catch {
    return {
      allowed: false,
      reason: "講座を作成できるか確認できませんでした。再読み込みしてもう一度お試しください。"
    };
  }
}
