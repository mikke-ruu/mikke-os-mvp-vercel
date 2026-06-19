export function StatCard({
  label,
  value,
  tone = "orange"
}: {
  label: string;
  value: string;
  tone?: "orange" | "green" | "navy" | "gray";
}) {
  const tones = {
    orange: "border-[#f2c8b8] bg-[#fff7f3] text-[#d9643a]",
    green: "border-[#cde5d3] bg-[#f3fbf4] text-[#4f8a61]",
    navy: "border-[#cfd9e5] bg-[#f5f8fb] text-[#243447]",
    gray: "border-[#e8e1da] bg-white text-[#25211f]"
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-semibold opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-normal">{value}</p>
    </div>
  );
}
