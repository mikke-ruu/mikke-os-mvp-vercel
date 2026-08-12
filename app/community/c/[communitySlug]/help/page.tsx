import { CommunityApp } from "@/components/community/CommunityApp";

export default async function CommunityHelpPage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = await params;
  return <CommunityApp view="help" communitySlug={communitySlug} />;
}
