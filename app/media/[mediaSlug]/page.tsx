"use client";

import { useParams } from "next/navigation";
import { PublicMediaHome } from "@/components/media-app/PublicMediaHome";

export default function PublicMediaPage() {
  const params = useParams<{ mediaSlug: string }>();
  return <PublicMediaHome mediaSlug={params.mediaSlug} />;
}
