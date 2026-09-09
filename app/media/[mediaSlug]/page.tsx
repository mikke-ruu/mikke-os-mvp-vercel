import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicMediaHome } from "@/components/media-app/PublicMediaHome";
import { mediaCanonicalUrl } from "@/lib/media-app/public-contract";
import { loadPublicMediaArticles, loadPublicMediaSite } from "@/lib/media-app/public-loader";

type Props = { params: Promise<{ mediaSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (process.env.NODE_ENV !== "development") return { title: "Media", robots: { index: false, follow: false } };
  const { mediaSlug } = await params;
  const site = await loadPublicMediaSite(mediaSlug);
  const canonical = mediaCanonicalUrl(mediaSlug);
  if (!site || !canonical) return { title: "Media", robots: { index: false, follow: false } };
  return { title: site.name, description: site.description, alternates: { canonical }, robots: { index: false, follow: false } };
}

export default async function PublicMediaPage({ params }: Props) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { mediaSlug } = await params;
  const [site, articles] = await Promise.all([
    loadPublicMediaSite(mediaSlug),
    loadPublicMediaArticles(mediaSlug)
  ]);
  if (!site || !articles) notFound();
  return <PublicMediaHome site={site} articles={articles} />;
}
