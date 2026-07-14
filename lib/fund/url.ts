export function normalizeFundExternalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export function isValidFundExternalUrl(value: string) {
  return value.trim().length === 0 || normalizeFundExternalUrl(value).length > 0;
}
