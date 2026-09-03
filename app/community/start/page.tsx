import { CommunityPlatformBilling } from "@/components/community/CommunityPlatformBilling";

export const metadata = { title: "COMMUNITY | 運営プラン", robots: { index: false, follow: false } };

export default function CommunityStartPage() {
  // Deliberately no checkout-success query handling or automatic resource creation.
  return <CommunityPlatformBilling />;
}
