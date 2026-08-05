import { CommunityApp } from "@/components/community/CommunityApp";

export default async function CommunityOwnerMembersPage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = await params;
  return <CommunityApp view="owner-members" communitySlug={communitySlug} />;
}
