import { CommunityApp } from "@/components/community/CommunityApp";

export default async function CommunityComposePage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = await params;
  return <CommunityApp view="compose" communitySlug={communitySlug} />;
}
