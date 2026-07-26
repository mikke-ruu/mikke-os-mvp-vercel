import type { ComponentType } from "react";

export type StatChipTone = "blue" | "pink" | "yellow" | "green" | "orange";

/** 青チップは白アイコン、他の薄い4色チップは黒アイコン（brief 4章）。 */
const toneStyles: Record<StatChipTone, { background: string; iconColor: string }> = {
  blue: { background: "var(--mikke-blue)", iconColor: "#ffffff" },
  orange: { background: "var(--mikke-orange)", iconColor: "#ffffff" },
  pink: { background: "var(--mikke-pink)", iconColor: "#1b1b1f" },
  yellow: { background: "var(--mikke-yellow)", iconColor: "#1b1b1f" },
  green: { background: "var(--mikke-green)", iconColor: "#1b1b1f" }
};

type StatChipProps = {
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  tone: StatChipTone;
  label: string;
  value: string;
  unit?: string;
};

/** アイコン塗りチップ＋日本語ラベル＋黒の数字。中央寄せ（STORY summary用）。 */
export function StatChip({ icon: Icon, tone, label, value, unit }: StatChipProps) {
  const style = toneStyles[tone];

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="grid h-11 w-11 place-items-center rounded-xl"
        style={{ background: style.background }}
      >
        <Icon size={22} color={style.iconColor} strokeWidth={2} />
      </div>
      <p className="mt-2 text-[11px] font-medium leading-4 text-[var(--mikke-muted)]">{label}</p>
      <p
        className="mt-0.5 text-[22px] font-bold leading-none text-[var(--mikke-text)]"
        style={{ fontFamily: "var(--mikke-font-display)", fontVariantNumeric: "tabular-nums" }}
      >
        {value}
        {unit ? <span className="ml-0.5 text-xs font-bold">{unit}</span> : null}
      </p>
    </div>
  );
}
