import { notFound } from "next/navigation";
import { FlowReview } from "./review";
import { academyReviewReturn } from "@/lib/academy/review-navigation";
export const metadata = {robots:{index:false,follow:false}};
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; from?: string | string[] }> }){
  if(process.env.NODE_ENV!=="development")notFound();
  const { tab, from } = await searchParams;
  return <FlowReview initialTab={tab === "community" ? "community" : "publish"} returnHref={academyReviewReturn(from)}/>;
}
