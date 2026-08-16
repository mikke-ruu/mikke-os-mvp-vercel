"use client";

import { useParams } from "next/navigation";
import { HqArticleEditor } from "@/components/hq/HqArticleEditor";

export default function HqEditArticlePage() {
  const params = useParams<{ id: string }>();
  return <HqArticleEditor articleId={params.id} />;
}
