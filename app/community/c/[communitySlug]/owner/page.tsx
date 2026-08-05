import { CommunityApp } from "@/components/community/CommunityApp";

export default async function CommunityOwnerPage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = await params;
  return <CommunityApp view="owner" communitySlug={communitySlug} />;
}
