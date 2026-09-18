import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OfferingParityReview } from "./review";
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Suspense fallback={<p>読み込み中…</p>}><OfferingParityReview /></Suspense>;
}
