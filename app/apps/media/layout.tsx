import { notFound } from "next/navigation";

export default function MediaPreviewLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== "development" && process.env.NEXT_PUBLIC_MEDIA_FREE_ENABLED !== "true") notFound();
  return children;
}
