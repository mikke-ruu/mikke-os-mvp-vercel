import { CommunityPlatformBilling } from "@/components/community/CommunityPlatformBilling";

export const metadata = { title: "COMMUNITY | 新しく作る", robots: { index: false, follow: false } };

export default function CommunityStartPage() {
  // Starting a trial only unlocks the guarded create form; it never auto-creates a Community.
  return <CommunityPlatformBilling startOnly />;
}
