import { CommunityParticipantAuthPage } from "@/components/community/CommunityApp";

export default async function CommunityTenantLoginPage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = await params;
  return <CommunityParticipantAuthPage communitySlug={communitySlug} />;
}
