import type { ReactNode } from "react";

type MikkeStatusBadgeTone = "success" | "primary" | "muted";

type MikkeStatusBadgeProps = {
  children: ReactNode;
  tone?: MikkeStatusBadgeTone;
  withDot?: boolean;
  className?: string;
};

const toneClasses: Record<MikkeStatusBadgeTone, string> = {
  success: "bg-[var(--mikke-success-soft)] text-[var(--mikke-success)]",
  primary: "border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] text-[var(--mikke-primary)]",
  muted: "border border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"
};

export function MikkeStatusBadge({ children, tone = "success", withDot = false, className = "" }: MikkeStatusBadgeProps) {
  return (
    <span className={`inline-flex max-w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${toneClasses[tone]} ${className}`}>
      {withDot ? <span className="h-2 w-2 shrink-0 rounded-full bg-current" /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
