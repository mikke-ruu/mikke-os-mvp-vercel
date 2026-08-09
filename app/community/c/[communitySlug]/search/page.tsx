import { CommunityApp } from "@/components/community/CommunityApp";

export default async function CommunitySearchPage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = await params;
  return <CommunityApp view="search" communitySlug={communitySlug} />;
}
