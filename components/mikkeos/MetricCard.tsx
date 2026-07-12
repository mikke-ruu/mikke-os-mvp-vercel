export function MetricCard({
  label,
  value,
  helper,
  tone = "orange"
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "orange" | "green" | "navy" | "gray";
}) {
  const tones = {
    orange: "border-[var(--mikke-primary-border)] bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]",
    green: "border-[var(--mikke-line)] bg-[var(--mikke-success-soft)] text-[var(--mikke-success)]",
    navy: "border-[var(--mikke-line)] bg-[var(--mikke-primary-soft)] text-[var(--mikke-primary)]",
    gray: "border-[var(--mikke-line)] bg-[var(--mikke-surface)] text-[var(--mikke-text)]"
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-bold opacity-75">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-normal">{value}</p>
      {helper ? <p className="mt-1 text-xs font-semibold opacity-75">{helper}</p> : null}
    </div>
  );
}
