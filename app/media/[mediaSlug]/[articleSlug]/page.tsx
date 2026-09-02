"use client";

import { useParams } from "next/navigation";
import { PublicMediaArticle } from "@/components/media-app/PublicMediaArticle";

export default function PublicMediaArticlePage() {
  const params = useParams<{ mediaSlug: string; articleSlug: string }>();
  return <PublicMediaArticle mediaSlug={params.mediaSlug} articleSlug={params.articleSlug} />;
}
