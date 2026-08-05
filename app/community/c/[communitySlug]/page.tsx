import { CommunityApp } from "@/components/community/CommunityApp";

export default async function CommunityHomePage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = await params;
  return <CommunityApp view="home" communitySlug={communitySlug} />;
}
