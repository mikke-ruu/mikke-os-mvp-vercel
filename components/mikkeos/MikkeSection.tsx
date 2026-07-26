import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type MikkeSectionProps = {
  title: string;
  action?: string;
  actionHref?: string;
  /**
   * "default" = 既存の日本語見出し（黒・通常表記）。他アプリはこのまま。
   * "editorial" = STORY基準UIの見出し（英大文字・青・letter-spacing・Poppins、action は "VIEW ALL" 表記）。
   */
  tone?: "default" | "editorial";
  children: ReactNode;
};

export function MikkeSection({ title, action, actionHref, tone = "default", children }: MikkeSectionProps) {
  const editorial = tone === "editorial";

  const actionNode = action ? (
    editorial ? (
      <span
        className="shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--mikke-muted)]"
        style={{ fontFamily: "var(--mikke-font-display)" }}
      >
        {action}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]">
        {action}
        <ChevronRight size={14} />
      </span>
    )
  ) : null;

  return (
    <section className="border-b border-[var(--mikke-line-soft)] py-5">
      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        <h2
          className={
            editorial
              ? "text-[15px] font-bold uppercase tracking-[0.14em] text-[var(--mikke-primary)]"
              : "text-base font-bold tracking-normal"
          }
          style={editorial ? { fontFamily: "var(--mikke-font-display)" } : undefined}
        >
          {title}
        </h2>
        {actionNode ? (
          actionHref ? (
            <Link href={actionHref} className="shrink-0">
              {actionNode}
            </Link>
          ) : (
            <button type="button" className="shrink-0">
              {actionNode}
            </button>
          )
        ) : null}
      </div>
      {children}
    </section>
  );
}
