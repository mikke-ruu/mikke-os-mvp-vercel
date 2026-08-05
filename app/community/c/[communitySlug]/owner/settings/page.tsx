import { CommunityApp } from "@/components/community/CommunityApp";

export default async function CommunityOwnerSettingsPage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = await params;
  return <CommunityApp view="owner-settings" communitySlug={communitySlug} />;
}
