/** Keep generated storage codes out of labels; explicit course codes remain visible. */
export function academyCourseCode(code?: string | null): string {
  const value = code?.trim() ?? "";
  return /^COURSE-(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{8}(?:-\d{4})?)$/i.test(value) ? "" : value;
}

export function academyCourseLabel(course: { name: string; code?: string | null }): string {
  return [academyCourseCode(course.code), course.name].filter(Boolean).join(" ");
}
