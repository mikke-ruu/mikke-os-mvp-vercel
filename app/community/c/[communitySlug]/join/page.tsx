import { CommunityApp } from "@/components/community/CommunityApp";

export default async function CommunityJoinPage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = await params;
  return <CommunityApp view="join" communitySlug={communitySlug} />;
}
