import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchDeliveryProjects, loadDeliveryProjectDetail } from "@/lib/team-works-delivery";
import { fetchProjectForms, fetchSubmissionsByFormIds } from "@/lib/team-works-delivery-forms";
import { fetchProjectDeliverables } from "@/lib/team-works-delivery-deliverables";
import { buildStaffPendingSummary, type DeliveryActionItem } from "@/lib/team-works-delivery-summary";
import {
  fetchOrganizationMemberNames,
  fetchRecentCommentRows,
  formatDateKey,
  type RecentOperationsComment
} from "@/lib/team-works-operations";

// ホーム(本部ダッシュボード)向け。全納品型プロジェクトを横断して
// 「クライアント待ち/本部確認待ち/期限超過」件数と、直近の期日を合算する。
// team-works-delivery-summary.tsのbuildStaffPendingSummaryはプロジェクト単位の
// 純粋関数なので、それをプロジェクトの数だけ回して合算するだけでよい。

export type DeliveryHomeActionItem = DeliveryActionItem & { projectId: string; projectTitle: string };

export type DeliveryHomeUpcoming = {
  projectId: string;
  projectTitle: string;
  taskId: string;
  taskTitle: string;
  date: string;
  kind: "submit" | "due" | "both";
};

export type DeliveryHomeSummary = {
  projectCount: number;
  clientWaitingCount: number;
  staffReviewCount: number;
  overdueCount: number;
  items: DeliveryHomeActionItem[];
  upcoming: DeliveryHomeUpcoming[];
};

const emptySummary: DeliveryHomeSummary = {
  projectCount: 0,
  clientWaitingCount: 0,
  staffReviewCount: 0,
  overdueCount: 0,
  items: [],
  upcoming: []
};

export async function loadDeliveryHomeSummary(client: SupabaseClient): Promise<DeliveryHomeSummary> {
  const projects = await fetchDeliveryProjects(client);
  if (projects.length === 0) return emptySummary;

  // toISOString()はUTCに変換するため、日本時間の朝9時までは前日の日付になり、
  // 期限超過・今後の期日の判定が朝だけ1日ずれていた。ローカル日付で揃える。
  const today = formatDateKey(new Date());
  let clientWaitingCount = 0;
  let staffReviewCount = 0;
  let overdueCount = 0;
  const items: DeliveryHomeActionItem[] = [];
  const upcoming: DeliveryHomeUpcoming[] = [];

  await Promise.all(
    projects.map(async (project) => {
      const detail = await loadDeliveryProjectDetail(client, project.id);
      if (!detail) return;

      const forms = await fetchProjectForms(client, project.id);
      const [submissions, deliverables] = await Promise.all([
        fetchSubmissionsByFormIds(client, forms),
        fetchProjectDeliverables(client, project.id)
      ]);
      const summary = buildStaffPendingSummary({ tasks: detail.tasks, forms, submissions, deliverables });
      clientWaitingCount += summary.clientWaitingCount;
      staffReviewCount += summary.staffReviewCount;
      overdueCount += summary.overdueCount;
      for (const item of summary.items) items.push({ ...item, projectId: project.id, projectTitle: project.title });

      for (const task of detail.tasks) {
        if (task.status === "completed" || task.status === "cancelled" || task.status === "archived") continue;
        const hasSubmit = Boolean(task.submitDueOn && task.submitDueOn >= today);
        const hasDue = Boolean(task.dueOn && task.dueOn >= today);
        // 提出期日と完了期日が同じ日なら1行にまとめる(Phase Eでカレンダー側に
        // 適用済みの規則と同じ。ホームの一覧だけ別ロジックだったため揃える)。
        if (hasSubmit && hasDue && task.submitDueOn === task.dueOn) {
          upcoming.push({ projectId: project.id, projectTitle: project.title, taskId: task.id, taskTitle: task.title, date: task.dueOn!, kind: "both" });
        } else {
          if (hasSubmit) upcoming.push({ projectId: project.id, projectTitle: project.title, taskId: task.id, taskTitle: task.title, date: task.submitDueOn!, kind: "submit" });
          if (hasDue) upcoming.push({ projectId: project.id, projectTitle: project.title, taskId: task.id, taskTitle: task.title, date: task.dueOn!, kind: "due" });
        }
      }
    })
  );

  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  items.sort((a, b) => {
    if (!a.dueOn && !b.dueOn) return 0;
    if (!a.dueOn) return 1;
    if (!b.dueOn) return -1;
    return a.dueOn.localeCompare(b.dueOn);
  });

  return {
    projectCount: projects.length,
    clientWaitingCount,
    staffReviewCount,
    overdueCount,
    items: items.slice(0, 8),
    upcoming: upcoming.slice(0, 8)
  };
}

// 納品ダッシュボードのMESSAGESカード用。運営ホームのfetchRecentCommentRowsと
// 同じteam_works_project_commentsを、納品型プロジェクトの範囲で読むだけ。
export async function loadDeliveryRecentComments(client: SupabaseClient): Promise<RecentOperationsComment[]> {
  const projects = await fetchDeliveryProjects(client);
  if (projects.length === 0) return [];

  const projectIds = projects.map((project) => project.id);
  const projectTitleById = new Map(projects.map((project) => [project.id, project.title]));
  const organizationIds = [...new Set(projects.map((project) => project.organizationId))];

  const [memberNameById, commentRows] = await Promise.all([
    fetchOrganizationMemberNames(client, organizationIds),
    fetchRecentCommentRows(client, projectIds, 6)
  ]);

  return commentRows.flatMap((row) => {
    const projectTitle = projectTitleById.get(row.project_id);
    if (!projectTitle) return [];
    return [{
      id: row.id,
      projectId: row.project_id,
      projectTitle,
      authorName: memberNameById.get(row.author_member_id) ?? "メンバー",
      body: row.body,
      createdAt: row.created_at
    }];
  });
}
