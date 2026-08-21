import type { MarketReflection } from "@/types/database";

export function mergeMarketNoteReflectionText(reflection: MarketReflection | null) {
  if (!reflection) return "";
  const main = (reflection.good_points ?? reflection.public_summary ?? reflection.private_note ?? "").trim();
  const formerNextAction = (reflection.next_actions ?? "").trim();
  if (!formerNextAction || main.includes(formerNextAction)) return main;
  return [main, formerNextAction].filter(Boolean).join("\n\n");
}
