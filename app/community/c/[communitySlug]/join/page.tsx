import { redirect } from "next/navigation";
import { communityBasePath } from "@/lib/community/routes";

export default async function CommunityJoinPage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = await params;
  redirect(communityBasePath(communitySlug));
}
