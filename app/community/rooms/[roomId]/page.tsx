import { CommunityApp } from "@/components/community/CommunityApp";
import { FIRST_COMMUNITY_SLUG } from "@/lib/community/routes";

export default async function CommunityRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <CommunityApp view="room" roomId={roomId} communitySlug={FIRST_COMMUNITY_SLUG} />;
}
