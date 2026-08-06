import { CommunityApp } from "@/components/community/CommunityApp";

export default async function CommunityPostPage({ params }: { params: Promise<{ communitySlug: string; roomId: string; postId: string }> }) {
  const { communitySlug, roomId, postId } = await params;
  return <CommunityApp view="post" roomId={roomId} postId={postId} communitySlug={communitySlug} />;
}
