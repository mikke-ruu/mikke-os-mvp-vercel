import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicMediaHome } from "@/components/media-app/PublicMediaHome";
import { mediaCanonicalUrl } from "@/lib/media-app/public-contract";
import { loadPublicMediaPage, loadPublicMediaSite } from "@/lib/media-app/public-loader";

type Props = { params: Promise<{ mediaSlug: string }>;searchParams:Promise<Record<string,string|string[]|undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (process.env.NODE_ENV !== "development" && process.env.NEXT_PUBLIC_MEDIA_FREE_ENABLED !== "true") return { title: "Media", robots: { index: false, follow: false } };
  const { mediaSlug } = await params;
  const site = await loadPublicMediaSite(mediaSlug);
  const canonical = mediaCanonicalUrl(mediaSlug);
  if (!site || !canonical) return { title: "Media", robots: { index: false, follow: false } };
  return { title: site.name, description: site.description, alternates: { canonical }, robots: { index: true, follow: true } };
}

export default async function PublicMediaPage({ params,searchParams }: Props) {
  if (process.env.NODE_ENV !== "development" && process.env.NEXT_PUBLIC_MEDIA_FREE_ENABLED !== "true") notFound();
  const { mediaSlug } = await params;
  const search=await searchParams;const get=(name:string)=>typeof search[name]==="string"?search[name] as string:"";
  const filters={page:Math.max(1,Math.min(1000000,Math.floor(Number(get("page")))||1)),query:get("q").slice(0,200),category:get("category").slice(0,60),month:/^\d{4}-\d{2}$/.test(get("month"))?get("month"):"",collection:/^[a-f0-9-]{36}$/.test(get("collection"))?get("collection"):""};
  const [site,pageData]=await Promise.all([loadPublicMediaSite(mediaSlug),loadPublicMediaPage(mediaSlug,filters)]);
  if(!site||!pageData)notFound();
  return <PublicMediaHome key={JSON.stringify(filters)} site={site} data={pageData} filters={filters}/>;
}
