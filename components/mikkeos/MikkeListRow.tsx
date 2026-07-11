import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type MikkeListRowProps = {
  title: string;
  label?: string;
  helper?: string;
  href?: string;
  icon?: LucideIcon;
  right?: ReactNode;
};

export function MikkeListRow({ title, label, helper, href, icon: Icon, right }: MikkeListRowProps) {
  const content = (
    <>
      {Icon ? (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--mikke-primary-soft)] text-[var(--mikke-primary)]">
          <Icon size={18} />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        {label ? <span className="block text-xs font-bold text-[var(--mikke-primary)]">{label}</span> : null}
        <span className="mt-1 block truncate text-sm font-bold">{title}</span>
        {helper ? <span className="mt-0.5 block truncate text-xs font-semibold text-[var(--mikke-muted)]">{helper}</span> : null}
      </span>
      {right ? <span className="shrink-0">{right}</span> : href ? <ChevronRight className="ml-auto shrink-0 text-[var(--mikke-muted-light)]" size={16} /> : null}
    </>
  );

  const className = "flex w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-3";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <article className={className}>{content}</article>;
}
