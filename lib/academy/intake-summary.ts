import type { AcademyApplication } from "@/types/database";
export function applicationIntakeCounts(apps: Pick<AcademyApplication, "intake_source">[]) {
  return { all: apps.length, honbu: apps.filter(a=>a.intake_source === "honbu").length, instructor: apps.filter(a=>a.intake_source === "koushi").length };
}
export function matchesIntake(app: Pick<AcademyApplication, "intake_source">, source: "all" | "honbu" | "koushi") {
  return source === "all" || app.intake_source === source;
}
