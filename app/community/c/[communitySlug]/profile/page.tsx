import { CommunityApp } from "@/components/community/CommunityApp";

export default async function CommunityProfilePage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = await params;
  return <CommunityApp view="profile" communitySlug={communitySlug} />;
}
