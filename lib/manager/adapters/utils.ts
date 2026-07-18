import type { ManagerItem, ManagerUrgency } from "../types";

export function classifyManagerDueDate(value: string | null | undefined, now = new Date()): ManagerUrgency {
  if (!value) return "unscheduled";
  const due = parseManagerDate(value);
  const today = startOfDay(now);
  const diffDays = Math.floor((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 7) return "week";
  return "later";
}

export function compareManagerDue(a: string | null, b: string | null, now = new Date()) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return parseManagerDate(a).getTime() - parseManagerDate(b).getTime() || urgencyRank(classifyManagerDueDate(a, now)) - urgencyRank(classifyManagerDueDate(b, now));
}

export function compareManagerItems(a: Pick<ManagerItem, "dueAt" | "urgency" | "title">, b: Pick<ManagerItem, "dueAt" | "urgency" | "title">, now = new Date()) {
  return compareManagerDue(a.dueAt, b.dueAt, now) || urgencyRank(a.urgency) - urgencyRank(b.urgency) || a.title.localeCompare(b.title, "ja");
}

export function progressFromStatus(status: string) {
  if (["completed", "delivered", "finished", "closed"].includes(status)) return 100;
  if (["in_progress", "confirmed", "goal_reached", "delivering"].includes(status)) return 70;
  if (["reviewing", "ready", "open", "interest_open"].includes(status)) return 45;
  if (["new", "requested", "submitted", "draft"].includes(status)) return 15;
  return 30;
}

function parseManagerDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`);
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function urgencyRank(urgency: ManagerUrgency) {
  if (urgency === "overdue") return 0;
  if (urgency === "today") return 1;
  if (urgency === "week") return 2;
  if (urgency === "later") return 3;
  return 4;
}

