export function isMissingSupabaseField(error: unknown, fields: string[]): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  const text = [record.message, record.details, record.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  const mentionsField = fields.some((field) => text.includes(field.toLowerCase()));
  return mentionsField && (code === "PGRST204" || code === "42703" || text.includes("schema cache") || text.includes("column"));
}

export function supabaseErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return fallback;
}
