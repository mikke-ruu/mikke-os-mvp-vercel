import { CommunityApp } from "@/components/community/CommunityApp";

export default async function CommunityOwnerModerationPage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = await params;
  return <CommunityApp view="owner-moderation" communitySlug={communitySlug} />;
}
