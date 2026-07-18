// mikke AI OFFICE — UI側の共通ロジック（表示専用。状態管理は lib/ai-office/store.ts）

import { roomForCase } from "@/lib/ai-office/data";
import type { Employee, OfficeCase, RoomId } from "@/lib/ai-office/types";

export type EmployeeState = "working" | "break" | "idle";

/** 社員の現在の稼働状態を判定する（spec: reception/working/review の案件があれば稼働中） */
export function getEmployeeState(employee: Employee, cases: OfficeCase[]): EmployeeState {
  const hasActiveCase = cases.some(
    (c) => c.assigneeId === employee.id && (c.status === "reception" || c.status === "working" || c.status === "review")
  );
  if (hasActiveCase) return "working";
  if (employee.homeRoomId === "break") return "break";
  return "idle";
}

export const employeeStateLabel: Record<EmployeeState, string> = {
  working: "稼働中",
  break: "休憩中",
  idle: "待機中"
};

export const employeeStateDotColor: Record<EmployeeState, string> = {
  working: "#4caf6e",
  break: "#d9a441",
  idle: "#9aa3b2"
};

/**
 * 社員が「今いる部屋」を案件状態から決める（フェーズ2）。
 * 1. review の案件があれば会議室
 * 2. working の案件があればその案件の部屋（roomForCase）
 * 3. reception の案件があればホームで待機
 * 4. 案件なしで休憩室所属なら休憩室
 * 5. それ以外はホーム
 */
export function roomForEmployee(employee: Employee, cases: OfficeCase[]): RoomId {
  const mine = cases.filter((c) => c.assigneeId === employee.id);
  if (mine.some((c) => c.status === "review")) return "meeting";
  const working = mine.find((c) => c.status === "working");
  if (working) return roomForCase(working);
  if (mine.some((c) => c.status === "reception")) return employee.homeRoomId;
  if (employee.homeRoomId === "break") return "break";
  return employee.homeRoomId;
}

const bubbles = ["作業中…", "がんばります！", "もう少しで完了", "集中中…", "順調です"];

/** 稼働中の社員がたまに出す吹き出しの文言（idごとに固定してちらつきを抑える） */
export function bubbleForEmployee(employeeId: string): string {
  let hash = 0;
  for (const ch of employeeId) hash += ch.charCodeAt(0);
  return bubbles[hash % bubbles.length];
}

export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

// ---- 稼働モニター用カテゴリ ----

export type MonitorCategory = {
  key: string;
  label: string;
  match: (c: OfficeCase) => boolean;
};

export const monitorCategories: MonitorCategory[] = [
  { key: "course", label: "講座制作室", match: (c) => c.jobType === "course" },
  { key: "editing", label: "編集室", match: (c) => c.jobType === "editing" },
  { key: "design", label: "デザイン室", match: (c) => c.jobType === "design" },
  { key: "coding", label: "実装室", match: (c) => c.jobType === "coding" },
  {
    key: "support",
    label: "サポート",
    match: (c) => c.jobType === "support" || c.jobType === "pr" || c.jobType === "research" || c.jobType === "other"
  }
];

export function workloadFor(cases: OfficeCase[], category: MonitorCategory): { value: number; openCount: number } {
  const openCount = cases.filter((c) => c.status !== "done" && category.match(c)).length;
  const value = Math.min(95, 20 + openCount * 15);
  return { value, openCount };
}
