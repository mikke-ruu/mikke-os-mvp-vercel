import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type MikkeSectionProps = {
  title: string;
  action?: string;
  children: ReactNode;
};

export function MikkeSection({ title, action, children }: MikkeSectionProps) {
  return (
    <section className="border-b border-[var(--mikke-line-soft)] py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold tracking-normal">{title}</h2>
        {action ? (
          <button type="button" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]">
            {action}
            <ChevronRight size={14} />
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}
