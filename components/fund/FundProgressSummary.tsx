import { formatYen } from "@/lib/format";
import { fundGoalTypeLabels, fundGoalUnitLabels, type FundProject } from "@/lib/fund/types";

export function FundProgressSummary({ project, publicView = false }: { project: FundProject; publicView?: boolean }) {
  const hidesAmount = project.goalType === "amount" && publicView && !project.displayAmount;
  const percent = project.goalValue > 0 ? Math.min(100, Math.round((project.currentValue / project.goalValue) * 100)) : 0;

  if (hidesAmount) {
    return (
      <div className="border-y border-[var(--mikke-line)] py-4">
        <p className="text-xs font-bold text-[var(--mikke-muted)]">現在の応援</p>
        <p className="mt-1 text-lg font-bold text-[var(--mikke-text)]">目標に向けて受付中です</p>
        <p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">金額は実行者の設定により非表示です。</p>
      </div>
    );
  }

  const current = project.goalType === "amount" ? formatYen(project.currentValue) : `${project.currentValue}${fundGoalUnitLabels[project.goalType]}`;
  const goal = project.goalType === "amount" ? formatYen(project.goalValue) : `${project.goalValue}${fundGoalUnitLabels[project.goalType]}`;

  return (
    <div className="border-y border-[var(--mikke-line)] py-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[var(--mikke-muted)]">{fundGoalTypeLabels[project.goalType]}の目標</p>
          <p className="mt-1 text-xl font-bold text-[var(--mikke-text)]">
            {current} <span className="text-sm text-[var(--mikke-muted)]">/ {goal}</span>
          </p>
        </div>
        <p className="text-sm font-bold text-[var(--mikke-accent)]">{percent}%</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--mikke-line-soft)]">
        <div className="h-full rounded-full bg-[var(--mikke-accent)]" style={{ width: `${percent}%` }} />
      </div>
      {publicView ? <p className="mt-2 text-xs font-semibold text-[var(--mikke-muted)]">表示値は実行者が登録・確認した内容に基づきます。</p> : null}
    </div>
  );
}
