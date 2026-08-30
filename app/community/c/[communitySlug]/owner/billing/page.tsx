import { CommunityApp } from "@/components/community/CommunityApp";

export default async function CommunityOwnerBillingPage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = await params;
  return <CommunityApp view="owner-billing" communitySlug={communitySlug} />;
}
