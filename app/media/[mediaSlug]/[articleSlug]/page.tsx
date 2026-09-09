import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicMediaArticle } from "@/components/media-app/PublicMediaArticle";
import { mediaCanonicalUrl } from "@/lib/media-app/public-contract";
import { loadPublicMediaArticle, loadPublicMediaSite } from "@/lib/media-app/public-loader";

type Props = { params: Promise<{ mediaSlug: string; articleSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (process.env.NODE_ENV !== "development" && process.env.NEXT_PUBLIC_MEDIA_FREE_ENABLED !== "true") return { title: "Media", robots: { index: false, follow: false } };
  const { mediaSlug, articleSlug } = await params;
  const article = await loadPublicMediaArticle(mediaSlug, articleSlug);
  const canonical = mediaCanonicalUrl(mediaSlug, articleSlug);
  if (!article || !canonical) return { title: "Media", robots: { index: false, follow: false } };
  return { title: article.title, description: article.excerpt, alternates: { canonical }, robots: { index: true, follow: true } };
}

export default async function PublicMediaArticlePage({ params }: Props) {
  if (process.env.NODE_ENV !== "development" && process.env.NEXT_PUBLIC_MEDIA_FREE_ENABLED !== "true") notFound();
  const { mediaSlug, articleSlug } = await params;
  const [site, article] = await Promise.all([
    loadPublicMediaSite(mediaSlug),
    loadPublicMediaArticle(mediaSlug, articleSlug)
  ]);
  if (!site || !article) notFound();
  return <PublicMediaArticle site={site} article={article} />;
}
