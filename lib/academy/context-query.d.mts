export function academyContextQuery(search: string | URLSearchParams): string;

export function withAcademyContextQuery(
  href: string,
  search: string | URLSearchParams,
  options?: { readonlyPreview?: boolean }
): string;
