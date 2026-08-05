import { CommunityApp } from "@/components/community/CommunityApp";

export default async function CommunityRoomsPage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = await params;
  return <CommunityApp view="rooms" communitySlug={communitySlug} />;
}
