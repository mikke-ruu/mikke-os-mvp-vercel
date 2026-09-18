import type { AcademyCourseMarketing } from "@/types/database";

/** Public presentation fields only. Lesson/program contents never enter this namespace. */
export function courseMarketing(raw: unknown): AcademyCourseMarketing {
  if (!raw || typeof raw !== "object") return {};
  const value = raw as Record<string, unknown>;
  return {
    category: typeof value.category === "string" ? value.category : "",
    images: Array.isArray(value.images) ? value.images.filter((item): item is string => typeof item === "string" && /^https?:\/\//i.test(item)) : [],
    curriculum: Array.isArray(value.curriculum) ? value.curriculum.filter((item): item is string => typeof item === "string") : [],
    imageSide: value.imageSide === "right" ? "right" : "left"
  };
}
export function courseImages(marketing: AcademyCourseMarketing, thumbnail?: string | null) {
  const images = marketing.images ?? [];
  // Keep the established main image field authoritative for old editors and list thumbnails.
  return thumbnail ? [thumbnail, ...images.slice(1).filter(url => url !== thumbnail)] : images;
}
