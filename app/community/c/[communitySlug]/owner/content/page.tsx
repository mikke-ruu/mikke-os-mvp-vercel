import { CommunityApp } from "@/components/community/CommunityApp";

export default async function CommunityOwnerContentPage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = await params;
  return <CommunityApp view="owner-content" communitySlug={communitySlug} />;
}
