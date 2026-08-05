const MIKKE_RESERVED_NAME_EXACT = new Set([
  "admin",
  "administrator",
  "api",
  "app",
  "apps",
  "auth",
  "billing",
  "community",
  "communities",
  "dashboard",
  "help",
  "home",
  "login",
  "logout",
  "manager",
  "member",
  "members",
  "mikke",
  "mikke-community",
  "mikke-id",
  "mikke-os",
  "mikkeos",
  "mikkeruu",
  "official",
  "official-academy",
  "official-academy-community",
  "official-partner",
  "official-trainer",
  "officialacademy",
  "officialpartner",
  "officialtrainer",
  "owner",
  "profile",
  "root",
  "settings",
  "staff",
  "support",
  "system"
]);

const MIKKE_RESERVED_NAME_PREFIXES = [
  "admin-",
  "api-",
  "mikke-",
  "mikkeos-",
  "mikkeruu-",
  "official-",
  "system-"
];

const MIKKE_RESERVED_NAME_CONTAINS = [
  "公式",
  "運営",
  "管理者",
  "認定",
  "オフィシャル"
];

export function normalizeMikkeReservedNameCandidate(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isMikkeReservedSlug(value: string) {
  const candidate = normalizeMikkeReservedNameCandidate(value);
  if (!candidate) return false;
  if (MIKKE_RESERVED_NAME_EXACT.has(candidate)) return true;
  return MIKKE_RESERVED_NAME_PREFIXES.some((prefix) => candidate.startsWith(prefix));
}

export function isMikkeReservedDisplayName(value: string) {
  const normalized = normalizeMikkeReservedNameCandidate(value);
  const compact = value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "");
  if (!normalized && !compact) return false;
  if (isMikkeReservedSlug(normalized)) return true;
  if (compact.includes("mikke") || compact.includes("mikkeos") || compact.includes("officialacademy")) return true;
  return MIKKE_RESERVED_NAME_CONTAINS.some((word) => compact.includes(word));
}

export function assertMikkeNameIsNotReserved(input: { slug?: string; displayName?: string; label?: string }) {
  const label = input.label ?? "この名前";
  if (input.slug && isMikkeReservedSlug(input.slug)) {
    throw new Error(`${label}はmikke公式・運営用に予約されています。別のURL用IDを指定してください。`);
  }
  if (input.displayName && isMikkeReservedDisplayName(input.displayName)) {
    throw new Error(`${label}はmikke公式・運営用に予約されています。別の表示名を指定してください。`);
  }
}

