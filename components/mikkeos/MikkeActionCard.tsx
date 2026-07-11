import { ExternalLink, type LucideIcon } from "lucide-react";
import Link from "next/link";

type MikkeActionCardProps = {
  title: string;
  helper: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
};

export function MikkeActionCard({ title, helper, icon: Icon, href, onClick }: MikkeActionCardProps) {
  const content = (
    <>
      <Icon size={22} />
      <span className="min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        <span className="mt-1 block text-xs font-semibold text-[var(--mikke-muted)]">{helper}</span>
      </span>
      <ExternalLink className="ml-auto shrink-0" size={15} />
    </>
  );

  const className =
    "flex min-h-20 items-center gap-3 rounded-lg border border-[var(--mikke-primary-border)] bg-white px-3 py-3 text-left text-[var(--mikke-primary)]";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
