import { CommunityApp } from "@/components/community/CommunityApp";

export default async function CommunityRoomPage({ params }: { params: Promise<{ communitySlug: string; roomId: string }> }) {
  const { communitySlug, roomId } = await params;
  return <CommunityApp view="room" roomId={roomId} communitySlug={communitySlug} />;
}
