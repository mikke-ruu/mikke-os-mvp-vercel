import { notFound, redirect } from "next/navigation";
import { AcademyUiReview } from "./review";
import { AuthGate } from "@/components/AuthGate";

export const metadata = { robots: { index: false, follow: false } };

export default async function AcademyUiReviewPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  if ((await searchParams).preview !== "walkthrough") redirect("/academy/ui-review?preview=walkthrough");
  return <AuthGate><AcademyUiReview /></AuthGate>;
}
