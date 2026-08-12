import { CommunityApp } from "@/components/community/CommunityApp";

export default async function CommunityOwnerSafetyPage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = await params;
  return <CommunityApp view="owner-safety" communitySlug={communitySlug} />;
}
