import { CommunityApp } from "@/components/community/CommunityApp";

export default async function CommunityEventsPage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = await params;
  return <CommunityApp view="events" communitySlug={communitySlug} />;
}
