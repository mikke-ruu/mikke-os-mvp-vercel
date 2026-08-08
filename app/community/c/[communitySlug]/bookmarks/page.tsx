import { CommunityApp } from "@/components/community/CommunityApp";

export default async function CommunityBookmarksPage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = await params;
  return <CommunityApp view="bookmarks" communitySlug={communitySlug} />;
}
