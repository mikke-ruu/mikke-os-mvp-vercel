import { CommunityApp } from "@/components/community/CommunityApp";

export default async function CommunityRulesPage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = await params;
  return <CommunityApp view="rules" communitySlug={communitySlug} />;
}
