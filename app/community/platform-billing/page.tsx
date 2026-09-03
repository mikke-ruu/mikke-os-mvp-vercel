import { CommunityPlatformBilling } from "@/components/community/CommunityPlatformBilling";

export const metadata = { title: "COMMUNITY | 契約・請求", robots: { index: false, follow: false } };

export default async function CommunityPlatformBillingPage({ searchParams }: {
  searchParams: Promise<{ resourceId?: string | string[] }>;
}) {
  const params = await searchParams;
  const resourceId = typeof params.resourceId === "string" ? params.resourceId : params.resourceId === undefined ? null : "invalid";
  return <CommunityPlatformBilling key={resourceId ?? "new"} resourceId={resourceId} />;
}
