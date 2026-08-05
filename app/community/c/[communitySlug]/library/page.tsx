import { CommunityApp } from "@/components/community/CommunityApp";

export default async function CommunityLibraryPage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = await params;
  return <CommunityApp view="library" communitySlug={communitySlug} />;
}
