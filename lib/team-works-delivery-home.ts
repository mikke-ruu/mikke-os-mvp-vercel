import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchDeliveryProjects, loadDeliveryProjectDetail } from "@/lib/team-works-delivery";
import { fetchProjectForms, fetchSubmissionsByFormIds } from "@/lib/team-works-delivery-forms";
import { fetchProjectDeliverables } from "@/lib/team-works-delivery-deliverables";
import { buildStaffPendingSummary, type DeliveryActionItem } from "@/lib/team-works-delivery-summary";

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
  kind: "submit" | "due";
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

  const today = new Date().toISOString().slice(0, 10);
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
        if (task.submitDueOn && task.submitDueOn >= today) {
          upcoming.push({ projectId: project.id, projectTitle: project.title, taskId: task.id, taskTitle: task.title, date: task.submitDueOn, kind: "submit" });
        }
        if (task.dueOn && task.dueOn >= today) {
          upcoming.push({ projectId: project.id, projectTitle: project.title, taskId: task.id, taskTitle: task.title, date: task.dueOn, kind: "due" });
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
