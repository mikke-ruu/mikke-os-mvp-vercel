type MikkeEmptyStateProps = {
  title: string;
  helper?: string;
};

export function MikkeEmptyState({ title, helper }: MikkeEmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-5 text-center">
      <p className="text-sm font-bold text-[var(--mikke-text)]">{title}</p>
      {helper ? <p className="mt-1 text-xs font-semibold leading-5 text-[var(--mikke-muted)]">{helper}</p> : null}
    </div>
  );
}
